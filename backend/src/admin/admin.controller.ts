import { Body, Controller, Get, Patch, Post, Param, Query, UseGuards } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TariffsService } from "../tariffs/tariffs.service";
import { CreateTariffDto } from "../tariffs/dto/create-tariff.dto";
import { AdminGuard } from "../common/guards/admin.guard";
import { WithdrawalsService } from "../withdrawals/withdrawals.service";

@Controller("admin")
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tariffsService: TariffsService,
    private readonly withdrawalsService: WithdrawalsService,
  ) {}

  @Get("stats")
  async stats() {
    const users = await this.prisma.user.count();
    const deposits = await this.prisma.deposit.count();
    const withdrawals = await this.prisma.transaction.count({
      where: { type: "WITHDRAW" },
    });
    return { users, deposits, withdrawals };
  }

  @Get("withdrawals")
  listWithdrawals(@Query("status") status?: string) {
    return this.prisma.transaction.findMany({
      where: { type: "WITHDRAW", status: status as any },
      orderBy: { createdAt: "desc" },
    });
  }

  @Patch("withdrawals/:id")
  updateWithdrawal(
    @Param("id") id: string,
    @Body() body: { status: string; txHash?: string },
  ) {
    const status = body.status?.toUpperCase() as "PENDING" | "COMPLETED" | "FAILED";
    return this.withdrawalsService.updateStatus(id, status, body.txHash);
  }

  @Post("tariffs")
  createTariff(@Body() dto: CreateTariffDto) {
    return this.tariffsService.create(dto);
  }

  @Patch("tariffs/:id")
  updateTariff(@Param("id") id: string, @Body() dto: Partial<CreateTariffDto>) {
    return this.tariffsService.update(id, dto);
  }
}
