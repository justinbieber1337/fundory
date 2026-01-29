import { BadRequestException, Controller, Post, UseGuards, Body, UnauthorizedException } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, CurrentUserDecorator } from "../common/decorators/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { UsersService } from "../users/users.service";

@Controller("admin-tools")
@UseGuards(JwtAuthGuard)
export class AdminToolsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  @Post("balance")
  async adjustBalance(
    @CurrentUserDecorator() user: CurrentUser,
    @Body()
    body: {
      targetUserId?: string;
      mainBalance?: number | string;
    },
  ) {
    const adminId = this.config.get<string>("ADMIN_TELEGRAM_ID");
    if (!adminId || String(user.telegramId) !== String(adminId)) {
      throw new UnauthorizedException("Admin only");
    }

    if (!body.targetUserId) {
      throw new BadRequestException("Target user id is required");
    }

    const target = body.targetUserId
      ? (await this.prisma.user.findUnique({ where: { id: body.targetUserId } })) ??
        (await this.prisma.user.findUnique({ where: { telegramId: String(body.targetUserId) } }))
      : null;
    if (!target) {
      throw new BadRequestException("Target user not found");
    }

    if (body.mainBalance === undefined || body.mainBalance === null || body.mainBalance === "") {
      throw new BadRequestException("Main balance is required");
    }
    let nextMain: Prisma.Decimal;
    try {
      nextMain = new Prisma.Decimal(body.mainBalance);
    } catch {
      throw new BadRequestException("Invalid main balance");
    }
    if (nextMain.lessThan(0)) {
      throw new BadRequestException("Balance cannot be negative");
    }

    const activeTariffs = await this.prisma.tariff.findMany({ where: { isActive: true } });

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id: target.id } });
      if (!current) {
        throw new BadRequestException("Target user not found");
      }
      const currentMain = new Prisma.Decimal(current.mainBalance);
      const delta = nextMain.minus(currentMain);

      const updated = await tx.user.update({
        where: { id: target.id },
        data: {
          mainBalance: nextMain,
        },
      });

      if (delta.greaterThan(0)) {
        await tx.user.update({
          where: { id: target.id },
          data: {
            stakedBalance: { increment: delta },
            personalDepositSum: { increment: delta },
          },
        });

        const tariff = this.pickTariff(activeTariffs, delta);
        let depositId: string | null = null;
        if (tariff) {
          const created = await tx.deposit.create({
            data: {
              userId: target.id,
              tariffId: tariff.id,
              amount: delta,
              status: "active",
            },
          });
          depositId = created.id;
        }

        await tx.transaction.create({
          data: {
            userId: target.id,
            type: "DEPOSIT",
            amount: delta,
            currency: "USDT",
            status: "COMPLETED",
            meta: {
              source: "admin",
              ...(depositId ? { depositId } : {}),
            },
          },
        });

        const referral = await tx.referral.findFirst({
          where: { referredId: target.id },
        });
        if (referral) {
          const minReferralDeposit = new Prisma.Decimal(
            process.env.REFERRAL_MIN_DEPOSIT ?? "175",
          );
          if (delta.greaterThanOrEqualTo(minReferralDeposit)) {
            if (!referral.hasDeposit) {
              await tx.referral.update({
                where: { id: referral.id },
                data: { hasDeposit: true },
              });
            }
            const level1 = await tx.user.findUnique({ where: { id: referral.referrerId } });
            const level2 = level1?.referrerId
              ? await tx.user.findUnique({ where: { id: level1.referrerId } })
              : null;
            const level3 = level2?.referrerId
              ? await tx.user.findUnique({ where: { id: level2.referrerId } })
              : null;
            const levelUsers = [level1, level2, level3].filter(Boolean) as Array<{ id: string }>;
            for (const levelUser of levelUsers) {
              await tx.user.update({
                where: { id: levelUser.id },
                data: { teamTurnoverSum: { increment: delta } },
              });
            }
            for (const levelUser of levelUsers) {
              await this.usersService.recalculateTier(levelUser.id, tx);
            }
          }
        }

        await this.usersService.recalculateTier(target.id, tx);
      }

      return updated;
    });
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

}
