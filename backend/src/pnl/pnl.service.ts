import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PnlService {
  constructor(private readonly prisma: PrismaService) {}

  @Cron("0 0 * * *")
  async createDailySnapshots() {
    const users = await this.prisma.user.findMany({
      select: { id: true, mainBalance: true },
    });

    for (const user of users) {
      const totalBalance = new Prisma.Decimal(user.mainBalance);

      await this.prisma.balanceSnapshot.create({
        data: {
          userId: user.id,
          totalBalance,
        },
      });
    }
  }

  async getUserPnl(userId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [
      totalAccrual,
      todayAccrual,
      monthAccrual,
      yearAccrual,
      yesterdayAccrual,
      snapshots,
      usdtAccruals,
      furEarned,
      furTransactions,
      activeRefs,
      user,
    ] =
      await Promise.all([
      this.prisma.accrual.aggregate({
        where: { userId, type: "interest" },
        _sum: { amount: true },
      }),
      this.prisma.accrual.aggregate({
        where: { userId, type: "interest", date: { gte: todayStart } },
        _sum: { amount: true },
      }),
      this.prisma.accrual.aggregate({
        where: { userId, type: "interest", date: { gte: monthStart } },
        _sum: { amount: true },
      }),
      this.prisma.accrual.aggregate({
        where: { userId, type: "interest", date: { gte: yearStart } },
        _sum: { amount: true },
      }),
      this.prisma.accrual.aggregate({
        where: { userId, type: "interest", date: { gte: yesterdayStart, lt: todayStart } },
        _sum: { amount: true },
      }),
      this.prisma.balanceSnapshot.findMany({
        where: { userId },
        orderBy: { date: "asc" },
        take: 30,
      }),
      this.prisma.accrual.findMany({
        where: { userId, type: "interest", createdAt: { gte: new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000) } },
        orderBy: { createdAt: "asc" },
      }),
        this.prisma.transaction.aggregate({
          where: { userId, type: "REFERRAL_BONUS" },
        _sum: { amount: true },
      }),
      this.prisma.transaction.findMany({
        where: {
          userId,
          currency: "FUR",
          type: { in: ["REFERRAL_BONUS", "SWAP"] },
        },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.referral.count({ where: { referrerId: userId, hasDeposit: true } }),
      this.prisma.user.findUnique({ where: { id: userId } }),
    ]);

    const pnlHistory = snapshots.map((item) => ({
      date: item.date,
      totalBalance: Number(item.totalBalance),
    }));

    const usdtDaily = new Map<string, number>();
    const startUsdt = new Date(now);
    startUsdt.setHours(0, 0, 0, 0);
    startUsdt.setDate(startUsdt.getDate() - 29);
    for (const accrual of usdtAccruals) {
      const key = new Date(accrual.createdAt).toISOString().slice(0, 10);
      usdtDaily.set(key, (usdtDaily.get(key) || 0) + Number(accrual.amount));
    }
    const usdtHistory = [];
    for (let i = 0; i < 30; i += 1) {
      const day = new Date(startUsdt);
      day.setDate(startUsdt.getDate() + i);
      const key = day.toISOString().slice(0, 10);
      usdtHistory.push({ date: day, totalBalance: usdtDaily.get(key) || 0 });
    }

    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 29);
    const furDaily = new Map<string, number>();
    for (const tx of furTransactions) {
      const key = new Date(tx.createdAt).toISOString().slice(0, 10);
      furDaily.set(key, (furDaily.get(key) || 0) + Number(tx.amount));
    }
    const furHistory = [];
    let cumulative = 0;
    for (let i = 0; i < 30; i += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const key = day.toISOString().slice(0, 10);
      cumulative += furDaily.get(key) || 0;
      furHistory.push({ date: day, totalBalance: cumulative });
    }

    return {
      totalProfitAllTime: Number(totalAccrual._sum.amount || 0),
      todayProfit: Number(todayAccrual._sum.amount || 0),
      monthProfit: Number(monthAccrual._sum.amount || 0),
      yearProfit: Number(yearAccrual._sum.amount || 0),
      yesterdayProfit: Number(yesterdayAccrual._sum.amount || 0),
      pnlHistory,
      usdtHistory,
      furHistory,
      furEarnedAllTime: Number(furEarned._sum.amount || 0),
      furFrozen: activeRefs < 3 ? Number(user?.furPending || 0) : 0,
      activeReferrals: activeRefs,
    };
  }
}
