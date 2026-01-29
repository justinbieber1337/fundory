import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TronService } from "./tron.service";
import { UsersService } from "../users/users.service";
import { TariffsService } from "../tariffs/tariffs.service";
import { TelegramNotificationService } from "../notifications/telegram-notification.service";
import { getDailyPercentForTier } from "../tiers/tier.config";

@Injectable()
export class TronScanner {
  private readonly logger = new Logger(TronScanner.name);
  private lastScanTimestamp = Date.now() - 60_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly tronService: TronService,
    private readonly usersService: UsersService,
    private readonly tariffsService: TariffsService,
    private readonly notifications: TelegramNotificationService,
  ) {}

  @Cron("*/30 * * * * *")
  async handleCron() {
    const autoScan = String(this.config.get<string>("TRON_AUTO_SCAN", "false")).toLowerCase();
    if (autoScan !== "true") return;
    await this.scanDeposits();
  }

  async scanDeposits(): Promise<void> {
    const minDeposit = Number(this.config.get<string>("TRON_MIN_DEPOSIT", "10"));
    const contractAddress =
      this.config.get<string>("TRON_USDT_CONTRACT") ||
      "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
    const now = Date.now();
    const lookback = Number(this.config.get<string>("TRON_SCAN_LOOKBACK_MS", "120000"));
    const fromTimestamp = Math.max(0, this.lastScanTimestamp - lookback);

    this.lastScanTimestamp = now;
    this.logger.log(`Scanning deposits since ${new Date(fromTimestamp).toISOString()}`);

    const tronWeb = this.tronService.getClient();
    const events = await this.fetchTransferEvents(tronWeb, contractAddress, fromTimestamp, now);
    if (!events.length) return;

    const activeTariffs = await this.tariffsService.listActive();
    for (const event of events) {
      const txHash =
        event?.transaction_id || event?.transactionId || event?.txid || event?.id || null;
      if (!txHash) continue;

      const confirmed = event?.confirmed ?? event?.result?.confirmed;
      if (confirmed === false) continue;

      const toAddress = this.normalizeAddress(tronWeb, event?.result?.to || event?.result?.toAddress);
      if (!toAddress) continue;

      const rawValue =
        event?.result?.value ??
        event?.result?.amount ??
        event?.result?.valueTRC20 ??
        event?.result?.["0"];
      const amount = this.parseUsdtAmount(rawValue);
      if (!amount || amount < minDeposit) continue;

      const wallet = await this.prisma.wallet.findUnique({
        where: { address: toAddress },
      });
      if (!wallet) continue;

      const processed = await this.applyDeposit({
        userId: wallet.userId,
        amount: new Prisma.Decimal(amount),
        txHash,
        toAddress,
        source: "tron",
        activeTariffs,
      });

      if (processed) {
        await this.notifyDeposit(wallet.userId, amount);
      }
    }
  }

  async scanDepositsForUser(userId: string) {
    const wallet = await this.prisma.wallet.findFirst({
      where: { userId, type: "deposit_wallet" },
    });
    if (!wallet) {
      return { processedCount: 0 };
    }

    const minDeposit = Number(this.config.get<string>("TRON_MIN_DEPOSIT", "10"));
    const contractAddress =
      this.config.get<string>("TRON_USDT_CONTRACT") ||
      "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
    const manualLookback = Number(
      this.config.get<string>("TRON_MANUAL_LOOKBACK_MS", "604800000"),
    );
    const now = Date.now();
    const fromTimestamp = Math.max(0, now - manualLookback);

    const tronWeb = this.tronService.getClient();
    const events = await this.fetchTransferEvents(tronWeb, contractAddress, fromTimestamp, now);
    if (!events.length) return { processedCount: 0 };

    const activeTariffs = await this.tariffsService.listActive();
    let processedCount = 0;
    for (const event of events) {
      const txHash =
        event?.transaction_id || event?.transactionId || event?.txid || event?.id || null;
      if (!txHash) continue;

      const confirmed = event?.confirmed ?? event?.result?.confirmed;
      if (confirmed === false) continue;

      const toAddress = this.normalizeAddress(
        tronWeb,
        event?.result?.to || event?.result?.toAddress,
      );
      if (!toAddress || toAddress !== wallet.address) continue;

      const rawValue =
        event?.result?.value ??
        event?.result?.amount ??
        event?.result?.valueTRC20 ??
        event?.result?.["0"];
      const amount = this.parseUsdtAmount(rawValue);
      if (!amount || amount < minDeposit) continue;

      const processed = await this.applyDeposit({
        userId,
        amount: new Prisma.Decimal(amount),
        txHash,
        toAddress,
        source: "tron_manual",
        activeTariffs,
      });
      if (processed) {
        processedCount += 1;
        await this.notifyDeposit(userId, amount);
      }
    }

    return { processedCount };
  }

  private async fetchTransferEvents(
    tronWeb: any,
    contractAddress: string,
    fromTimestamp: number,
    toTimestamp: number,
  ) {
    try {
      const events = await tronWeb.getEventResult(contractAddress, {
        eventName: "Transfer",
        size: Number(this.config.get<string>("TRON_SCAN_BATCH", "200")),
        onlyConfirmed: true,
        min_timestamp: fromTimestamp,
        max_timestamp: toTimestamp,
        orderBy: "block_timestamp,desc",
      });
      return Array.isArray(events) ? events : [];
    } catch (err: any) {
      this.logger.error(`Tron scan failed: ${err?.message || err}`);
      return [];
    }
  }

  private normalizeAddress(tronWeb: any, value?: string) {
    if (!value) return null;
    if (value.startsWith("T")) return value;
    try {
      return tronWeb.address.fromHex(value);
    } catch {
      return null;
    }
  }

  private parseUsdtAmount(value: unknown) {
    if (value === null || value === undefined) return 0;
    try {
      const raw = typeof value === "string" ? value : String(value);
      const numeric = raw.startsWith("0x") ? BigInt(raw) : BigInt(raw);
      return Number(numeric) / 1_000_000;
    } catch {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed / 1_000_000 : 0;
    }
  }

  private pickTariff(activeTariffs: Array<{ id: string; minDeposit: Prisma.Decimal }>, amount: Prisma.Decimal) {
    if (!activeTariffs.length) return null;
    const sorted = [...activeTariffs].sort((a, b) => Number(a.minDeposit) - Number(b.minDeposit));
    let selected = sorted[0];
    for (const tariff of sorted) {
      if (amount.greaterThanOrEqualTo(tariff.minDeposit)) {
        selected = tariff;
      }
    }
    return selected;
  }

  private async notifyDeposit(userId: string, amount: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.telegramId) return;

    const dailyPercent = getDailyPercentForTier(user.currentTier);
    const message = `✅ Deposit Confirmed! +${amount.toFixed(
      2,
    )} USDT added to your staked balance. Your daily profit is now ${dailyPercent}%.\n`;

    await this.notifications.sendMessage(user.telegramId, message);
  }

  private async applyDeposit(params: {
    userId: string;
    amount: Prisma.Decimal;
    txHash?: string | null;
    toAddress?: string;
    source: string;
    activeTariffs: Array<{ id: string; minDeposit: Prisma.Decimal }>;
  }) {
    const { userId, amount, txHash, toAddress, source, activeTariffs } = params;
    return this.prisma.$transaction(async (tx) => {
      if (txHash) {
        const existing = await tx.transaction.findUnique({ where: { txHash } });
        if (existing) return false;
      }

      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) return false;

      await tx.user.update({
        where: { id: userId },
        data: {
          stakedBalance: { increment: amount },
          personalDepositSum: { increment: amount },
        },
      });

      const tariff = this.pickTariff(activeTariffs, amount);
      let depositId: string | null = null;
      if (tariff) {
        const created = await tx.deposit.create({
          data: {
            userId,
            tariffId: tariff.id,
            amount,
            status: "active",
          },
        });
        depositId = created.id;
      }

      await tx.transaction.create({
        data: {
          userId,
          type: "DEPOSIT",
          amount,
          currency: "USDT",
          status: "COMPLETED",
          txHash: txHash ?? undefined,
          meta: {
            source,
            toAddress,
            ...(depositId ? { depositId } : {}),
          },
        },
      });

      const referral = await tx.referral.findFirst({
        where: { referredId: userId },
      });
      if (referral) {
        const minReferralDeposit = new Prisma.Decimal(
          this.config.get<string>("REFERRAL_MIN_DEPOSIT", "175"),
        );
        const qualifies = amount.greaterThanOrEqualTo(minReferralDeposit);

        let activeCount = 0;
        if (qualifies) {
          if (!referral.hasDeposit) {
            await tx.referral.update({
              where: { id: referral.id },
              data: { hasDeposit: true },
            });
          }

          activeCount = await tx.referral.count({
            where: { referrerId: referral.referrerId, hasDeposit: true },
          });

          const level1 = await tx.user.findUnique({ where: { id: referral.referrerId } });
          const level2 = level1?.referrerId
            ? await tx.user.findUnique({ where: { id: level1.referrerId } })
            : null;
          const level3 = level2?.referrerId
            ? await tx.user.findUnique({ where: { id: level2.referrerId } })
            : null;
          const levelUsers = [level1, level2, level3].filter(Boolean) as Array<{
            id: string;
          }>;

          for (const levelUser of levelUsers) {
            await tx.user.update({
              where: { id: levelUser.id },
              data: {
                teamTurnoverSum: { increment: amount },
                totalTurnover: { increment: amount },
              },
            });
          }

          const levelPercents = [
            activeCount >= 4 ? 0.0525 : 0.025,
            0.025,
            0.0075,
          ];
          for (let i = 0; i < levelUsers.length; i += 1) {
            const levelUser = levelUsers[i];
            const percentBonus = amount.mul(levelPercents[i]);
            if (percentBonus.greaterThan(0)) {
              await tx.user.update({
                where: { id: levelUser.id },
                data: { furPending: { increment: percentBonus } },
              });
              await tx.transaction.create({
                data: {
                  userId: levelUser.id,
                  type: "REFERRAL_BONUS",
                  amount: percentBonus,
                  currency: "FUR",
                  status: "COMPLETED",
                  meta: { referredId: userId, txHash, kind: "level_bonus", level: i + 1 },
                },
              });
            }
          }
        }
      }

      await this.usersService.recalculateTier(userId, tx);
      if (referral?.referrerId) {
        await this.usersService.recalculateTier(referral.referrerId, tx);
        const level1 = await tx.user.findUnique({ where: { id: referral.referrerId } });
        if (level1?.referrerId) {
          await this.usersService.recalculateTier(level1.referrerId, tx);
          const level2 = await tx.user.findUnique({ where: { id: level1.referrerId } });
          if (level2?.referrerId) {
            await this.usersService.recalculateTier(level2.referrerId, tx);
          }
        }
      }

      return true;
    });
  }
}
