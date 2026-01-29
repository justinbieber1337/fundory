import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TelegramNotificationService } from "../notifications/telegram-notification.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { getAllTiers, getDailyPercentForTier, resolveTier } from "../tiers/tier.config";

type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: TelegramNotificationService,
  ) {}

  async findOrCreateFromTelegram(user: TelegramUser, refCode?: string) {
    const telegramId = String(user.id);
    const existing = await this.prisma.user.findUnique({ where: { telegramId } });
    if (existing) {
      if (refCode && !existing.referrerId) {
        const normalized = this.normalizeRefCode(refCode);
        const referrer = normalized
          ? await this.prisma.user.findUnique({ where: { refCode: normalized } })
          : null;
        if (referrer && referrer.id !== existing.id) {
          const updated = await this.prisma.$transaction(async (tx) => {
            await tx.referral.upsert({
              where: {
                referrerId_referredId: {
                  referrerId: referrer.id,
                  referredId: existing.id,
                },
              },
              create: { referrerId: referrer.id, referredId: existing.id },
              update: {},
            });
            return tx.user.update({
              where: { id: existing.id },
              data: { referrerId: referrer.id },
            });
          });
          await this.notifyReferral(referrer.id, existing);
          if (updated) return updated;
        }
      }
      return existing;
    }

    const generatedRefCode = await this.generateRefCode();
    const result = await this.prisma.$transaction(async (tx) => {
      let referrerId: string | undefined;
      if (refCode) {
        const normalized = this.normalizeRefCode(refCode);
        const referrer = normalized
          ? await tx.user.findUnique({ where: { refCode: normalized } })
          : null;
        if (referrer) {
          referrerId = referrer.id;
        }
      }

      const created = await tx.user.create({
        data: {
          telegramId,
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
          language: user.language_code || "ru",
          refCode: generatedRefCode,
          referrerId,
        },
      });

      if (referrerId) {
        await tx.referral.upsert({
          where: {
            referrerId_referredId: {
              referrerId,
              referredId: created.id,
            },
          },
          create: { referrerId, referredId: created.id },
          update: {},
        });
      }

      return { created, referrerId };
    });
    if (result.referrerId) {
      await this.notifyReferral(result.referrerId, result.created);
    }
    return result.created;
  }

  async getById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) return null;
    return {
      ...user,
      effectiveTier: this.resolveEffectiveTier(user),
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        language: dto.language ?? undefined,
        notifyDailyProfit: dto.notifyDailyProfit ?? undefined,
        notifyDeposit: dto.notifyDeposit ?? undefined,
        notifyWithdraw: dto.notifyWithdraw ?? undefined,
        autoReinvest: dto.autoReinvest ?? undefined,
      },
    });
  }

  async recalculateTier(userId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    const user = await client.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    const nextTier = resolveTier(
      new Prisma.Decimal(user.personalDepositSum),
      new Prisma.Decimal(user.teamTurnoverSum),
    );

    if (user.currentTier !== nextTier) {
      await client.user.update({
        where: { id: userId },
        data: { currentTier: nextTier },
      });
    }

    return nextTier;
  }

  resolveEffectiveTier(user: {
    currentTier: number;
    tierBoostTier?: number | null;
    tierBoostUntil?: Date | null;
  }) {
    if (user.tierBoostTier && user.tierBoostUntil && user.tierBoostUntil.getTime() > Date.now()) {
      return Math.max(user.currentTier, user.tierBoostTier);
    }
    return user.currentTier;
  }

  async listPayoutAddresses(userId: string) {
    return this.prisma.payoutAddress.findMany({ where: { userId } });
  }

  async getStats(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    const amountInWork = Number(user.stakedBalance || 0);
    const dailyPercent = getDailyPercentForTier(this.resolveEffectiveTier(user));
    const dailyIncome = Number((amountInWork * dailyPercent) / 100);

    const tiers = getAllTiers();
    const nextTier = tiers.find((tier) => tier.tier === user.currentTier + 1) || null;
    let progressToNext = 0;
    if (nextTier) {
      const personalRemaining = Math.max(0, Number(nextTier.minPersonal) - Number(user.personalDepositSum));
      const teamRemaining = Math.max(0, Number(nextTier.minTeam) - Number(user.teamTurnoverSum));
      progressToNext = Math.min(personalRemaining, teamRemaining);
    }

    return {
      currentTier: user.currentTier,
      effectiveTier: this.resolveEffectiveTier(user),
      progressToNextTier: progressToNext,
      dailyIncome,
      amountInWork,
    };
  }

  async addPayoutAddress(userId: string, address: string, label?: string) {
    const count = await this.prisma.payoutAddress.count({ where: { userId } });
    if (count >= 3) {
      throw new BadRequestException("Maximum 3 payout addresses allowed");
    }
    return this.prisma.payoutAddress.create({
      data: { userId, address, label },
    });
  }

  async removePayoutAddress(userId: string, id: string) {
    return this.prisma.payoutAddress.deleteMany({
      where: { id, userId },
    });
  }

  private async generateRefCode(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      const exists = await this.prisma.user.findUnique({ where: { refCode: code } });
      if (!exists) return code;
    }
    this.logger.error("Failed to generate unique refCode after 20 attempts");
    throw new Error("Failed to generate referral code");
  }

  private async notifyReferral(referrerId: string, referred: { username?: string | null; firstName?: string | null }) {
    const referrer = await this.prisma.user.findUnique({ where: { id: referrerId } });
    if (!referrer?.telegramId) return;
    const name =
      (referred.username && `@${referred.username}`) || referred.firstName || "new user";
    const message = `👥 New referral joined: ${name}`;
    await this.notifications.sendMessage(referrer.telegramId, message);
  }

  private normalizeRefCode(value?: string) {
    if (!value) return null;
    return value.replace(/^ref_/i, "").toUpperCase();
  }
}
