import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TelegramNotificationService } from "../notifications/telegram-notification.service";
import { CreateWithdrawalDto } from "./dto/create-withdrawal.dto";

@Injectable()
export class WithdrawalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: TelegramNotificationService,
  ) {}

  async createRequest(userId: string, dto: CreateWithdrawalDto) {
    const amount = new Prisma.Decimal(dto.amount);
    const minWithdrawal = new Prisma.Decimal("10");
    if (amount.lessThan(minWithdrawal)) {
      throw new BadRequestException("Minimum withdrawal is 10 USDT");
    }
    const { transaction, user } = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new BadRequestException("Insufficient balance");
      }

      const [profitSum, pendingSum, completedSum] = await Promise.all([
        tx.accrual.aggregate({
          where: { userId, type: "interest" },
          _sum: { amount: true },
        }),
        tx.transaction.aggregate({
          where: { userId, type: "WITHDRAW", status: "PENDING" },
          _sum: { amount: true },
        }),
        tx.transaction.aggregate({
          where: { userId, type: "WITHDRAW", status: "COMPLETED" },
          _sum: { amount: true },
        }),
      ]);
      const profitTotal = new Prisma.Decimal(profitSum._sum.amount || 0);
      const pending = new Prisma.Decimal(pendingSum._sum.amount || 0);
      const completed = new Prisma.Decimal(completedSum._sum.amount || 0);
      const availableProfit = profitTotal.sub(pending).sub(completed);
      if (availableProfit.lessThan(amount)) {
        throw new BadRequestException("Insufficient profit balance");
      }

      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: "WITHDRAW",
          amount,
          currency: "USDT",
          status: "PENDING",
          meta: { toAddress: dto.address },
        },
      });

      return { transaction, user };
    });
    await this.notifyAdmin(user, transaction.id, amount, dto.address);
    return transaction;
  }

  async create(userId: string, dto: CreateWithdrawalDto) {
    return this.createRequest(userId, dto);
  }

  async updateStatus(id: string, status: "PENDING" | "COMPLETED" | "FAILED", txHash?: string) {
    const existing = await this.prisma.transaction.findUnique({ where: { id } });
    if (!existing || existing.type !== "WITHDRAW") {
      throw new BadRequestException("Withdrawal not found");
    }
    if (existing.status === "COMPLETED" || existing.status === "FAILED") {
      return existing;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (status === "COMPLETED") {
        const user = await tx.user.findUnique({ where: { id: existing.userId } });
        if (!user) {
          throw new BadRequestException("Insufficient balance");
        }
        const [profitSum, pendingSum, completedSum] = await Promise.all([
          tx.accrual.aggregate({
            where: { userId: existing.userId, type: "interest" },
            _sum: { amount: true },
          }),
          tx.transaction.aggregate({
            where: {
              userId: existing.userId,
              type: "WITHDRAW",
              status: "PENDING",
              id: { not: existing.id },
            },
            _sum: { amount: true },
          }),
          tx.transaction.aggregate({
            where: {
              userId: existing.userId,
              type: "WITHDRAW",
              status: "COMPLETED",
              id: { not: existing.id },
            },
            _sum: { amount: true },
          }),
        ]);
        const profitTotal = new Prisma.Decimal(profitSum._sum.amount || 0);
        const pending = new Prisma.Decimal(pendingSum._sum.amount || 0);
        const completed = new Prisma.Decimal(completedSum._sum.amount || 0);
        const availableProfit = profitTotal.sub(pending).sub(completed);
        if (availableProfit.lessThan(existing.amount)) {
          throw new BadRequestException("Insufficient profit balance");
        }
        await tx.user.update({
          where: { id: existing.userId },
          data: { stakedBalance: { decrement: existing.amount } },
        });
      }
      return tx.transaction.update({
        where: { id },
        data: { status, txHash },
      });
    });

    if (status === "COMPLETED") {
      await this.notifyUser(updated.userId, Number(updated.amount));
    } else if (status === "FAILED") {
      await this.notifyUser(updated.userId, Number(updated.amount), true);
    }

    return updated;
  }

  private async notifyAdmin(
    user: { telegramId: string; username: string | null; firstName: string | null; lastName: string | null },
    transactionId: string,
    amount: Prisma.Decimal,
    address: string,
  ) {
    const name =
      (user.username && `@${user.username}`) ||
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.telegramId;
    const addressLink = `https://tronscan.org/#/address/${address}`;
    const message = [
      "🚨 New Withdrawal Request!",
      `User: ${name}`,
      `Amount: ${amount.toFixed(2)} USDT`,
      `Address: <a href="${addressLink}">${address}</a>`,
      `Transaction ID: ${transactionId}`,
    ].join("\n");

    await this.notifications.sendAdminMessage(message, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Approve", callback_data: `withdraw:approve:${transactionId}` },
            { text: "❌ Reject", callback_data: `withdraw:reject:${transactionId}` },
          ],
        ],
      },
    });
  }

  private async notifyUser(userId: string, amount: number, failed = false) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.telegramId) return;
    const message = failed
      ? `❌ Your withdrawal of ${amount.toFixed(2)} USDT was rejected.`
      : `✅ Your withdrawal of ${amount.toFixed(2)} USDT has been processed. Check your wallet!`;
    await this.notifications.sendMessage(user.telegramId, message);
  }
}
