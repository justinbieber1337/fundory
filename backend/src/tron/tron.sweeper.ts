import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { Prisma, SystemTransferStatus, SystemTransferType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TronService } from "./tron.service";
import { WalletsService } from "../wallets/wallets.service";

@Injectable()
export class TronSweeper {
  private readonly logger = new Logger(TronSweeper.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly tronService: TronService,
    private readonly walletsService: WalletsService,
  ) {}

  @Cron("*/60 * * * * *")
  async handleCron() {
    await this.sweepWallets();
  }

  async sweepWallets() {
    const masterAddress = this.config.get<string>("MASTER_WALLET_ADDRESS");
    const masterPrivateKey = this.config.get<string>("MASTER_WALLET_PRIVATE_KEY");
    if (!masterAddress || !masterPrivateKey) {
      this.logger.warn("MASTER_WALLET_ADDRESS or MASTER_WALLET_PRIVATE_KEY not set");
      return;
    }

    const minUsdt = Number(this.config.get<string>("TRON_SWEEP_MIN_USDT", "5"));
    const trxThreshold = Number(this.config.get<string>("TRON_SWEEP_TRX_THRESHOLD", "15"));
    const trxTopup = Number(this.config.get<string>("TRON_SWEEP_TRX_TOPUP", "20"));
    const contractAddress =
      this.config.get<string>("TRON_USDT_CONTRACT") ||
      "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

    const wallets = await this.prisma.wallet.findMany({ where: { type: "deposit_wallet" } });
    const client = this.tronService.getClient();

    for (const wallet of wallets) {
      const blocked = await this.isRetryBlocked(wallet.id);
      if (blocked) continue;

      const usdtBalance = await this.getUsdtBalance(client, contractAddress, wallet.address);
      if (usdtBalance < minUsdt) continue;

      const credited = await this.hasCreditedDeposit(wallet.userId, wallet.address);
      if (!credited) {
        this.logger.warn(`Sweep skipped: no credited deposit for ${wallet.address}`);
        continue;
      }

      const trxBalance = await this.getTrxBalance(client, wallet.address);
      if (trxBalance < trxThreshold) {
        await this.topupGas(wallet, masterAddress, masterPrivateKey, trxTopup, trxBalance);
      }

      const updatedTrx = await this.getTrxBalance(client, wallet.address);
      if (updatedTrx < trxThreshold) {
        await this.logSweepFailure(wallet, usdtBalance, masterAddress, "Insufficient TRX for sweep");
        continue;
      }

      await this.sweepUsdt(wallet, masterAddress, contractAddress, usdtBalance);
    }
  }

  private async isRetryBlocked(walletId: string) {
    const failed = await this.prisma.systemTransfer.findFirst({
      where: {
        walletId,
        type: SystemTransferType.SWEEP,
        status: SystemTransferStatus.FAILED,
      },
      orderBy: { createdAt: "desc" },
    });
    if (!failed?.nextRetryAt) return false;
    return failed.nextRetryAt.getTime() > Date.now();
  }

  private async hasCreditedDeposit(userId: string, address: string) {
    return this.prisma.transaction.findFirst({
      where: {
        userId,
        type: "DEPOSIT",
        status: "COMPLETED",
        meta: {
          path: ["toAddress"],
          equals: address,
        },
      },
    });
  }

  private async getTrxBalance(client: any, address: string) {
    const balanceSun = await client.trx.getBalance(address);
    return Number(balanceSun) / 1_000_000;
  }

  private async getUsdtBalance(client: any, contractAddress: string, address: string) {
    const contract = await client.contract().at(contractAddress);
    const raw = await contract.balanceOf(address).call();
    const value = typeof raw === "object" && raw._hex ? raw._hex : raw.toString();
    return this.parseUsdtAmount(value);
  }

  private parseUsdtAmount(value: string) {
    try {
      const numeric = value.startsWith("0x") ? BigInt(value) : BigInt(value);
      return Number(numeric) / 1_000_000;
    } catch {
      return 0;
    }
  }

  private async topupGas(
    wallet: { id: string; userId: string; address: string },
    masterAddress: string,
    masterPrivateKey: string,
    amountTrx: number,
    currentTrx: number,
  ) {
    try {
      const result = await this.tronService.sendTrx(masterPrivateKey, wallet.address, amountTrx);
      await this.prisma.systemTransfer.create({
        data: {
          walletId: wallet.id,
          userId: wallet.userId,
          type: SystemTransferType.GAS_TOPUP,
          status: SystemTransferStatus.COMPLETED,
          amount: new Prisma.Decimal(amountTrx),
          currency: "TRX",
          txHash: result?.txid || result?.txID || null,
          fromAddress: masterAddress,
          toAddress: wallet.address,
          meta: { currentTrx },
        },
      });
    } catch (err: any) {
      await this.prisma.systemTransfer.create({
        data: {
          walletId: wallet.id,
          userId: wallet.userId,
          type: SystemTransferType.GAS_TOPUP,
          status: SystemTransferStatus.FAILED,
          amount: new Prisma.Decimal(amountTrx),
          currency: "TRX",
          fromAddress: masterAddress,
          toAddress: wallet.address,
          meta: { error: err?.message || String(err) },
        },
      });
    }
  }

  private async sweepUsdt(
    wallet: { id: string; userId: string; address: string; privateKey: string },
    masterAddress: string,
    contractAddress: string,
    usdtBalance: number,
  ) {
    try {
      if (!wallet.privateKey) {
        await this.logSweepFailure(
          wallet,
          usdtBalance,
          masterAddress,
          "Missing wallet private key",
        );
        return;
      }
      const encryptedKey = wallet.privateKey;
      const privateKey = this.walletsService.decryptWalletPrivateKey(encryptedKey);
      const result = await this.tronService.sendUsdt(
        privateKey,
        masterAddress,
        usdtBalance,
        contractAddress,
      );
      await this.prisma.systemTransfer.create({
        data: {
          walletId: wallet.id,
          userId: wallet.userId,
          type: SystemTransferType.SWEEP,
          status: SystemTransferStatus.COMPLETED,
          amount: new Prisma.Decimal(usdtBalance),
          currency: "USDT",
          txHash: result?.txid || result?.txID || result || null,
          fromAddress: wallet.address,
          toAddress: masterAddress,
        },
      });
    } catch (err: any) {
      await this.logSweepFailure(wallet, usdtBalance, masterAddress, err?.message || String(err));
    }
  }

  private async logSweepFailure(
    wallet: { id: string; userId: string; address: string },
    usdtBalance: number,
    masterAddress: string,
    error: string,
  ) {
    const nextRetryAt = new Date(Date.now() + 5 * 60 * 1000);
    await this.prisma.systemTransfer.create({
      data: {
        walletId: wallet.id,
        userId: wallet.userId,
        type: SystemTransferType.SWEEP,
        status: SystemTransferStatus.FAILED,
        amount: new Prisma.Decimal(usdtBalance),
        currency: "USDT",
        fromAddress: wallet.address,
        toAddress: masterAddress,
        nextRetryAt,
        attempts: 1,
        meta: { error },
      },
    });
  }
}
