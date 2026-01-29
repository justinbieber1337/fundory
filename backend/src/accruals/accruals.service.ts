import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TelegramNotificationService } from "../notifications/telegram-notification.service";
import { calculateDailyAccrual, resolveTier } from "../tiers/tier.config";

@Injectable()
export class AccrualsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: TelegramNotificationService,
  ) {}

  async runDailyAccruals() {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const rewardsByUser = new Map<string, { telegramId: string | null; amount: number }>();

    const deposits = await this.prisma.deposit.findMany({
      where: { status: "active" },
      include: { user: true },
    });

    for (const deposit of deposits) {
      const alreadyAccrued = await this.prisma.accrual.findFirst({
        where: {
          depositId: deposit.id,
          type: "interest",
          date: { gte: dayStart, lt: dayEnd },
        },
      });
      if (alreadyAccrued) {
        continue;
      }

      const tier = this.resolveEffectiveTier(deposit.user);
      const accrualAmount = calculateDailyAccrual(new Prisma.Decimal(deposit.amount), tier);

      try {
        await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          await tx.accrual.create({
            data: {
              userId: deposit.userId,
              depositId: deposit.id,
              amount: accrualAmount,
              type: "interest",
              date: dayStart,
            },
          });

          await tx.deposit.update({
            where: { id: deposit.id },
            data: { amount: { increment: accrualAmount } },
          });

          const updatedUser = await tx.user.update({
            where: { id: deposit.userId },
            data: {
              personalDepositSum: { increment: accrualAmount },
              stakedBalance: { increment: accrualAmount },
              mainBalance: { increment: accrualAmount },
            },
          });

          const nextTier = resolveTier(
            new Prisma.Decimal(updatedUser.personalDepositSum),
            new Prisma.Decimal(updatedUser.teamTurnoverSum),
          );
          if (updatedUser.currentTier !== nextTier) {
            await tx.user.update({
              where: { id: deposit.userId },
              data: { currentTier: nextTier },
            });
          }

          await tx.transaction.create({
            data: {
              userId: deposit.userId,
              type: "ACCRUAL",
              amount: accrualAmount,
              currency: "USDT",
              status: "COMPLETED",
              meta: { depositId: deposit.id },
            },
          });
        });
      } catch (err: any) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          continue;
        }
        throw err;
      }

      const prev = rewardsByUser.get(deposit.userId);
      if (prev) {
        prev.amount += Number(accrualAmount);
      } else {
        rewardsByUser.set(deposit.userId, {
          telegramId: deposit.user.telegramId,
          amount: Number(accrualAmount),
        });
      }
    }

    for (const reward of rewardsByUser.values()) {
      await this.notifyReward(reward.telegramId, reward.amount);
    }
  }

  private resolveEffectiveTier(user: {
    currentTier: number;
    tierBoostTier?: number | null;
    tierBoostUntil?: Date | null;
    personalDepositSum?: Prisma.Decimal;
    teamTurnoverSum?: Prisma.Decimal;
  }) {
    const baseTier = resolveTier(
      new Prisma.Decimal(user.personalDepositSum ?? 0),
      new Prisma.Decimal(user.teamTurnoverSum ?? 0),
    );
    if (user.tierBoostTier && user.tierBoostUntil && user.tierBoostUntil.getTime() > Date.now()) {
      return Math.max(baseTier, user.tierBoostTier);
    }
    return baseTier;
  }

  async processMaturedStakes() {
    const now = new Date();
    const deposits = await this.prisma.deposit.findMany({
      where: {
        status: "active",
        stakeActivatedAt: { not: null },
        stakeDurationDays: { not: null },
      },
      include: { user: true },
    });

    for (const deposit of deposits) {
      const activatedAt = deposit.stakeActivatedAt ? new Date(deposit.stakeActivatedAt).getTime() : 0;
      const durationDays = Number(deposit.stakeDurationDays || 0);
      const endAt = activatedAt + durationDays * 24 * 60 * 60 * 1000;
      if (!activatedAt || !durationDays || endAt > now.getTime()) {
        continue;
      }

      if (deposit.autoReinvest) {
        await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          await tx.deposit.update({
            where: { id: deposit.id },
            data: {
              status: "completed",
              endDate: now,
            },
          });
          await tx.deposit.create({
            data: {
              userId: deposit.userId,
              tariffId: deposit.tariffId,
              amount: deposit.amount,
              status: "active",
              stakeDurationDays: deposit.stakeDurationDays,
              stakeActivatedAt: now,
              autoReinvest: true,
            },
          });
        });
      await this.notifyStakeMatured(deposit.user.telegramId, deposit.id, true);
        continue;
      }

      const accrualSum = await this.prisma.accrual.aggregate({
        where: { depositId: deposit.id, type: "interest" },
        _sum: { amount: true },
      });
      const totalAccrued = new Prisma.Decimal(accrualSum._sum.amount || 0);
      const principal = new Prisma.Decimal(deposit.amount).sub(totalAccrued);
      const safePrincipal = principal.greaterThan(0) ? principal : new Prisma.Decimal(0);

      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.deposit.update({
          where: { id: deposit.id },
          data: {
            status: "completed",
            endDate: now,
            stakeActivatedAt: null,
          },
        });
        await tx.user.update({
          where: { id: deposit.userId },
          data: {
            stakedBalance: { decrement: new Prisma.Decimal(deposit.amount) },
            mainBalance: { increment: safePrincipal },
          },
        });
      });
      await this.notifyStakeMatured(deposit.user.telegramId, deposit.id, false);
    }
  }

  private async notifyStakeMatured(telegramId: string | null, depositId: string, autoReinvest: boolean) {
    const message = autoReinvest
      ? `✅ Stake matured. Auto-reinvested. Deposit: ${depositId}`
      : `✅ Stake matured. Principal returned. Deposit: ${depositId}`;
    await this.notifications.sendMessage(telegramId, message);
  }

  private async notifyReward(telegramId: string | null, amount: number) {
    const message = `✨ Daily reward credited: +${amount.toFixed(2)} USDT`;
    await this.notifications.sendMessage(telegramId, message);
  }
}
