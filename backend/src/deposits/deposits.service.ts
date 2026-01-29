import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TelegramNotificationService } from "../notifications/telegram-notification.service";
import { CreateDepositDto } from "./dto/create-deposit.dto";
import { ActivateStakeDto } from "./dto/activate-stake.dto";
import { TariffsService } from "../tariffs/tariffs.service";
import { UsersService } from "../users/users.service";

@Injectable()
export class DepositsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tariffsService: TariffsService,
    private readonly usersService: UsersService,
    private readonly notifications: TelegramNotificationService,
  ) {}

  listByUser(userId: string) {
    return this.prisma.deposit.findMany({
      where: { userId },
      include: { tariff: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(userId: string, dto: CreateDepositDto) {
    const tariff = await this.tariffsService.getById(dto.tariffId);
    if (!tariff || !tariff.isActive) {
      throw new BadRequestException("Tariff not available");
    }

    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lessThan(tariff.minDeposit)) {
      throw new BadRequestException("Amount below minimum");
    }
    if (tariff.maxDeposit && amount.greaterThan(tariff.maxDeposit)) {
      throw new BadRequestException("Amount above maximum");
    }

    const bonusNotifications: Array<{
      referrerId: string;
      amount: Prisma.Decimal;
      level: number;
      depositId: string;
      referredId: string;
    }> = [];

    const created = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || new Prisma.Decimal(user.mainBalance).lessThan(amount)) {
        throw new BadRequestException("Insufficient balance");
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          mainBalance: { decrement: amount },
          personalDepositSum: { increment: amount },
          stakedBalance: { increment: amount },
        },
      });

      const created = await tx.deposit.create({
        data: {
          userId,
          tariffId: tariff.id,
          amount,
          status: "active",
        },
      });

      const referral = await tx.referral.findFirst({ where: { referredId: userId } });

      if (referral) {
        const minReferralDeposit = new Prisma.Decimal(
          process.env.REFERRAL_MIN_DEPOSIT ?? "175",
        );
        const qualifies = amount.greaterThanOrEqualTo(minReferralDeposit);

        if (qualifies && !referral.hasDeposit) {
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
            data: {
              teamTurnoverSum: { increment: amount },
              totalTurnover: { increment: amount },
            },
          });
        }

        const activeCount = await tx.referral.count({
          where: { referrerId: referral.referrerId, hasDeposit: true },
        });
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
                meta: { referredId: userId, depositId: created.id, kind: "level_bonus", level: i + 1 },
              },
            });
            bonusNotifications.push({
              referrerId: levelUser.id,
              amount: percentBonus,
              level: i + 1,
              depositId: created.id,
              referredId: userId,
            });
            await this.notifyUserReferralBonus(levelUser.id, percentBonus, i + 1);
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

      return created;
    });

    for (const bonus of bonusNotifications) {
      await this.notifyAdminReferralBonus(
        bonus.referrerId,
        bonus.amount,
        bonus.level,
        bonus.referredId,
      );
    }

    return created;
  }

  async activateStake(userId: string, depositId: string, dto: ActivateStakeDto) {
    const deposit = await this.prisma.deposit.findUnique({ where: { id: depositId } });
    if (!deposit || deposit.userId !== userId) {
      throw new BadRequestException("Deposit not found");
    }
    if (deposit.status !== "active") {
      throw new BadRequestException("Deposit not active");
    }
    if (deposit.stakeActivatedAt) {
      return deposit;
    }
    if (dto.amount !== undefined && new Prisma.Decimal(dto.amount).greaterThan(deposit.amount)) {
      throw new BadRequestException("Stake amount exceeds balance");
    }
    return this.prisma.deposit.update({
      where: { id: depositId },
      data: {
        stakeDurationDays: dto.durationDays,
        stakeActivatedAt: new Date(),
      },
    });
  }

  async updateAutoReinvest(userId: string, depositId: string, autoReinvest: boolean) {
    const deposit = await this.prisma.deposit.findUnique({ where: { id: depositId } });
    if (!deposit || deposit.userId !== userId) {
      throw new BadRequestException("Deposit not found");
    }
    return this.prisma.deposit.update({
      where: { id: depositId },
      data: { autoReinvest },
    });
  }

  async emergencyUnstake(userId: string, depositId: string) {
    const deposit = await this.prisma.deposit.findUnique({ where: { id: depositId } });
    if (!deposit || deposit.userId !== userId) {
      throw new BadRequestException("Deposit not found");
    }
    if (deposit.status !== "active") {
      throw new BadRequestException("Deposit not active");
    }

    const amount = new Prisma.Decimal(deposit.amount);
    const penalty = amount.mul(0.075);
    const payout = amount.sub(penalty);

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.deposit.update({
        where: { id: depositId },
        data: { status: "canceled", endDate: new Date(), stakeActivatedAt: null },
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          mainBalance: { increment: payout },
          stakedBalance: { decrement: amount },
          personalDepositSum: { decrement: amount },
        },
      });
    });

    await this.notifyAdminEmergencyUnstake(userId, depositId, amount, penalty);

    return { returned: payout, penalty };
  }

  private async notifyAdminReferralBonus(
    referrerId: string,
    amount: Prisma.Decimal,
    level: number,
    referredId: string,
  ) {
    const referrer = await this.prisma.user.findUnique({ where: { id: referrerId } });
    const referred = await this.prisma.user.findUnique({ where: { id: referredId } });
    if (!referrer) return;
    const refName =
      (referrer.username && `@${referrer.username}`) ||
      [referrer.firstName, referrer.lastName].filter(Boolean).join(" ") ||
      referrer.telegramId;
    const referredName =
      (referred?.username && `@${referred.username}`) ||
      [referred?.firstName, referred?.lastName].filter(Boolean).join(" ") ||
      referred?.telegramId ||
      "User";
    const message = [
      "✅ Referral bonus credited",
      `Referrer: ${refName}`,
      `Referred: ${referredName}`,
      `Level: ${level}`,
      `Amount: ${amount.toFixed(2)} FUR`,
    ].join("\n");
    await this.notifications.sendAdminMessage(message);
  }

  private async notifyAdminEmergencyUnstake(
    userId: string,
    depositId: string,
    amount: Prisma.Decimal,
    penalty: Prisma.Decimal,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const name =
      (user?.username && `@${user.username}`) ||
      [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
      user?.telegramId ||
      "User";
    const message = [
      "⚠️ Emergency unstake",
      `User: ${name}`,
      `Deposit: ${depositId}`,
      `Amount: ${amount.toFixed(2)} USDT`,
      `Penalty: ${penalty.toFixed(2)} USDT`,
    ].join("\n");
    await this.notifications.sendAdminMessage(message);
  }

  private async notifyUserReferralBonus(userId: string, amount: Prisma.Decimal, level: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.telegramId) return;
    const message = `🎁 Referral bonus L${level}: +${amount.toFixed(2)} FUR`;
    await this.notifications.sendMessage(user.telegramId, message);
  }
}
