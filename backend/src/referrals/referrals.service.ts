import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TelegramNotificationService } from "../notifications/telegram-notification.service";

@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: TelegramNotificationService,
  ) {}

  async stats(userId: string, botUsername: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    const total = await this.prisma.referral.count({ where: { referrerId: userId } });
    const referrals = await this.prisma.referral.findMany({
      where: { referrerId: userId },
      include: {
        referred: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            telegramId: true,
            deposits: {
              where: { status: "active" },
              orderBy: { startDate: "desc" },
              take: 1,
              include: { tariff: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    let withDeposit = 0;
    for (const item of referrals) {
      const hasActiveDeposit = Boolean(item.referred.deposits?.length);
      if (hasActiveDeposit) {
        withDeposit += 1;
        if (!item.hasDeposit) {
          await this.prisma.referral.update({
            where: { id: item.id },
            data: { hasDeposit: true },
          });
        }
      } else if (item.hasDeposit) {
        withDeposit += 1;
      }
    }

    const turnover = Number(user.totalTurnover || 0);

    const referredIds = referrals.map((item) => item.referredId);
    const referralCounts = referredIds.length
      ? await this.prisma.referral.groupBy({
          by: ["referrerId"],
          where: { referrerId: { in: referredIds } },
          _count: { _all: true },
        })
      : [];
    const referralCountMap = new Map<string, number>();
    for (const item of referralCounts) {
      referralCountMap.set(item.referrerId, item._count._all);
    }

    const link = `https://t.me/${botUsername}?startapp=ref_${user.refCode}`;
    return {
      refCode: user.refCode,
      referralLink: link,
      totalReferrals: total,
      referralsWithDeposit: withDeposit,
      referralBalance: user.furPending,
      referralAvailable: user.furBalance,
      referralPending: user.furPending,
      referralsTurnover: turnover,
      referrals: referrals.map((item) => {
        const referred = item.referred;
        const name =
          (referred.username && `@${referred.username}`) ||
          referred.firstName ||
          referred.telegramId ||
          "User";
        const activeTariff = referred.deposits[0]?.tariff?.name || "No tariff";
        const hasActiveDeposit = Boolean(referred.deposits?.length);
        return {
          id: item.id,
          userId: referred.id,
          name,
          hasDeposit: item.hasDeposit || hasActiveDeposit,
          tariff: activeTariff,
          referralsCount: referralCountMap.get(referred.id) || 0,
        };
      }),
    };
  }

  async children(requesterId: string, targetUserId: string) {
    const relation = await this.prisma.referral.findFirst({
      where: { referrerId: requesterId, referredId: targetUserId },
    });
    if (!relation) {
      throw new UnauthorizedException("Not allowed");
    }

    const referrals = await this.prisma.referral.findMany({
      where: { referrerId: targetUserId },
      include: {
        referred: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            telegramId: true,
            deposits: {
              where: { status: "active" },
              orderBy: { startDate: "desc" },
              take: 1,
              include: { tariff: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    for (const item of referrals) {
      const hasActiveDeposit = Boolean(item.referred.deposits?.length);
      if (hasActiveDeposit && !item.hasDeposit) {
        await this.prisma.referral.update({
          where: { id: item.id },
          data: { hasDeposit: true },
        });
      }
    }

    const referredIds = referrals.map((item) => item.referredId);
    const referralCounts = referredIds.length
      ? await this.prisma.referral.groupBy({
          by: ["referrerId"],
          where: { referrerId: { in: referredIds } },
          _count: { _all: true },
        })
      : [];
    const referralCountMap = new Map<string, number>();
    for (const item of referralCounts) {
      referralCountMap.set(item.referrerId, item._count._all);
    }

    return referrals.map((item) => {
      const referred = item.referred;
      const name =
        (referred.username && `@${referred.username}`) ||
        referred.firstName ||
        referred.telegramId ||
        "User";
      const activeTariff = referred.deposits[0]?.tariff?.name || "No tariff";
      const hasActiveDeposit = Boolean(referred.deposits?.length);
      return {
        id: item.id,
        userId: referred.id,
        name,
        hasDeposit: item.hasDeposit || hasActiveDeposit,
        tariff: activeTariff,
        referralsCount: referralCountMap.get(referred.id) || 0,
      };
    });
  }

  async leaderboard() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        telegramId: true,
        createdAt: true,
        totalTurnover: true,
      },
    });

    const leaderboard = users.map((user) => {
      const name =
        (user.username && `@${user.username}`) ||
        user.firstName ||
        user.telegramId ||
        "User";

      const turnover = Number(user.totalTurnover || 0);

      return {
        id: user.id,
        name,
        turnover,
        createdAt: user.createdAt,
      };
    });

    leaderboard.sort((a, b) => {
      if (b.turnover !== a.turnover) return b.turnover - a.turnover;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    return leaderboard.map((item, index) => ({
      id: item.id,
      rank: index + 1,
      name: item.name,
      turnover: item.turnover,
    }));
  }

  async recalculateTotalTurnover() {
    const referrals = await this.prisma.referral.findMany({
      select: { referrerId: true, referredId: true },
    });
    const referrerMap = new Map<string, string[]>();
    for (const ref of referrals) {
      const list = referrerMap.get(ref.referrerId) || [];
      list.push(ref.referredId);
      referrerMap.set(ref.referrerId, list);
    }

    const depositSums = await this.prisma.deposit.groupBy({
      by: ["userId"],
      where: { status: "active" },
      _sum: { amount: true },
    });
    const depositMap = new Map<string, number>();
    for (const item of depositSums) {
      depositMap.set(item.userId, Number(item._sum.amount || 0));
    }

    const users = await this.prisma.user.findMany({
      select: { id: true, totalTurnover: true },
    });

    const sumTurnover = (rootId: string) => {
      const level1 = referrerMap.get(rootId) || [];
      const level2 = level1.flatMap((id) => referrerMap.get(id) || []);
      const level3 = level2.flatMap((id) => referrerMap.get(id) || []);
      const all = new Set([...level1, ...level2, ...level3]);
      let total = 0;
      for (const id of all) {
        total += depositMap.get(id) || 0;
      }
      return total;
    };

    let updated = 0;
    const batchSize = 50;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (user) => {
          const turnover = sumTurnover(user.id);
          const current = Number(user.totalTurnover || 0);
          if (Math.abs(turnover - current) < 0.0001) return;
          updated += 1;
          await this.prisma.user.update({
            where: { id: user.id },
            data: { totalTurnover: turnover },
          });
        }),
      );
    }

    return updated;
  }

  async withdrawReferral(userId: string, amount: number) {
    const minActive = 3;
    const activeCount = await this.prisma.referral.count({
      where: { referrerId: userId, hasDeposit: true },
    });
    if (activeCount < minActive) {
      throw new BadRequestException("Referral withdrawals not enabled yet");
    }

    const withdrawalAmount = new Prisma.Decimal(amount);
    const transaction = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || new Prisma.Decimal(user.furPending).lessThan(withdrawalAmount)) {
        throw new BadRequestException("Insufficient referral balance");
      }

      await tx.user.update({
        where: { id: userId },
        data: { furPending: { decrement: withdrawalAmount } },
      });

      return tx.transaction.create({
        data: {
          userId,
          type: "WITHDRAW",
          amount: withdrawalAmount,
          currency: "FUR",
          status: "PENDING",
          meta: { source: "referral" },
        },
      });
    });
    await this.notifyAdminReferral(userId, withdrawalAmount);
    return transaction;
  }

  async claimFur(userId: string) {
    const activeCount = await this.prisma.referral.count({
      where: { referrerId: userId, hasDeposit: true },
    });
    if (activeCount < 3) {
      throw new BadRequestException("Claim requires 3 active referrals");
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || new Prisma.Decimal(user.furPending).lessThanOrEqualTo(0)) {
        throw new BadRequestException("No FUR available");
      }

      const amount = new Prisma.Decimal(user.furPending);

      await tx.user.update({
        where: { id: userId },
        data: {
          furPending: { decrement: amount },
          furBalance: { increment: amount },
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: "SWAP",
          amount,
          currency: "FUR",
          status: "COMPLETED",
          meta: { kind: "claim", source: "referral" },
        },
      });

      return { claimed: amount };
    });
  }

  async swapFurToUsdt(userId: string) {
    return this.claimFur(userId);
  }

  private async notifyAdminReferral(userId: string, amount: Prisma.Decimal) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    const payout = await this.prisma.payoutAddress.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    const name =
      (user.username && `@${user.username}`) ||
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.telegramId;
    const addressLine = payout?.address ? `Address: ${payout.address}` : "Address: not provided";
    const message = [
      "🚨 New Referral Withdrawal!",
      `User: ${name}`,
      `Amount: ${amount.toFixed(2)} FUR`,
      addressLine,
    ].join("\n");
    await this.notifications.sendAdminMessage(message);
  }
}
