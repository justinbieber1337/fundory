import { Controller, Get, UseGuards } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { getDailyPercentForTier } from "../tiers/tier.config";
import { UsersService } from "../users/users.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, CurrentUserDecorator } from "../common/decorators/current-user.decorator";

@Controller("dashboard")
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  async getDashboard(@CurrentUserDecorator() user: CurrentUser) {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      profile,
      transactions,
      totalAccruals,
      accrualsToday,
      accrualsMonth,
      completedWithdrawSum,
      pendingWithdrawSum,
    ] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: user.userId } }),
      this.prisma.transaction.findMany({
        where: { userId: user.userId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      this.prisma.accrual.aggregate({
        where: { userId: user.userId },
        _sum: { amount: true },
      }),
      this.prisma.accrual.aggregate({
        where: { userId: user.userId, date: { gte: dayStart } },
        _sum: { amount: true },
      }),
      this.prisma.accrual.aggregate({
        where: { userId: user.userId, date: { gte: monthStart } },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { userId: user.userId, type: "WITHDRAW", status: "COMPLETED" },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { userId: user.userId, type: "WITHDRAW", status: "PENDING" },
        _sum: { amount: true },
      }),
    ]);

    const inTariffs = Number((profile as any)?.stakedBalance ?? 0);
    const totalIncome = Number(totalAccruals._sum.amount || 0);
    const profitCompleted = Number(completedWithdrawSum._sum.amount || 0);
    const profitPending = Number(pendingWithdrawSum._sum.amount || 0);
    const profitAvailable = Math.max(0, totalIncome - profitCompleted - profitPending);
    const balance = Number(profile?.mainBalance ?? 0);
    const furBalance = Number(profile?.furBalance ?? 0);
    const incomeToday = Number(accrualsToday._sum.amount || 0);
    const incomeMonth = Number(accrualsMonth._sum.amount || 0);
    const effectiveTier = profile ? this.usersService.resolveEffectiveTier(profile as any) : 0;
    const dailyPercent = profile ? getDailyPercentForTier(effectiveTier) : 0;

    return {
      balance,
      inTariffs,
      available: balance,
      furBalance,
      incomeToday,
      incomeMonth,
      incomeTotal: totalIncome,
      profitAvailable,
      dailyPercent,
      effectiveTier,
      recentTransactions: transactions,
    };
  }
}
