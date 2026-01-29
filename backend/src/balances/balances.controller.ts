import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, CurrentUserDecorator } from "../common/decorators/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";

@Controller("balances")
@UseGuards(JwtAuthGuard)
export class BalancesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getBalances(@CurrentUserDecorator() user: CurrentUser) {
    const profile = await this.prisma.user.findUnique({ where: { id: user.userId } });
    const [profitSum, completedWithdrawSum, pendingWithdrawSum] = await Promise.all([
      this.prisma.accrual.aggregate({
        where: { userId: user.userId, type: "interest" },
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

    const inTariffs = Number(profile?.stakedBalance ?? 0);
    const balance = Number(profile?.mainBalance ?? 0);
    const furBalance = Number(profile?.furBalance ?? 0);
    const profitTotal = Number(profitSum._sum.amount || 0);
    const profitCompleted = Number(completedWithdrawSum._sum.amount || 0);
    const profitPending = Number(pendingWithdrawSum._sum.amount || 0);
    const profitAvailable = Math.max(0, profitTotal - profitCompleted - profitPending);

    return {
      total: balance,
      inTariffs,
      available: balance,
      furBalance,
      profitTotal,
      profitPending,
      profitAvailable,
    };
  }

}
