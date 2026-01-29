import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTariffDto } from "./dto/create-tariff.dto";
import { getAllTiers } from "../tiers/tier.config";

@Injectable()
export class TariffsService {
  constructor(private readonly prisma: PrismaService) {}

  async listActive() {
    const existing = await this.prisma.tariff.findMany({ where: { isActive: true } });
    if (existing.length) return existing;

    await this.prisma.tariff.createMany({
      data: [
        {
          name: "Starter",
          description: "Daily accruals, flexible",
          monthlyPercent: 10,
          minDeposit: 50,
          maxDeposit: 999,
          termDays: 30,
          isActive: true,
        },
        {
          name: "Growth",
          description: "Higher yield, 60 days",
          monthlyPercent: 15,
          minDeposit: 1000,
          maxDeposit: 9999,
          termDays: 60,
          isActive: true,
        },
        {
          name: "Pro",
          description: "Max yield, 90 days",
          monthlyPercent: 20,
          minDeposit: 10000,
          maxDeposit: null,
          termDays: 90,
          isActive: true,
        },
      ],
    });

    return this.prisma.tariff.findMany({ where: { isActive: true } });
  }

  getById(id: string) {
    return this.prisma.tariff.findUnique({ where: { id } });
  }

  create(dto: CreateTariffDto) {
    return this.prisma.tariff.create({ data: dto });
  }

  update(id: string, dto: Partial<CreateTariffDto>) {
    return this.prisma.tariff.update({ where: { id }, data: dto });
  }

  async purchaseNextTierBoost(userId: string) {
    const cost = new Prisma.Decimal(1000);
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new BadRequestException("User not found");
      }
      if (user.tierBoostUntil && user.tierBoostUntil.getTime() > now.getTime()) {
        throw new BadRequestException("Tier boost already active");
      }
      if (new Prisma.Decimal(user.furBalance).lessThan(cost)) {
        throw new BadRequestException("Insufficient FUR balance");
      }

      const tiers = getAllTiers().map((tier) => tier.tier);
      const maxTier = Math.max(...tiers);
      const nextTier = Math.min(maxTier, Number(user.currentTier || 0) + 1);
      if (nextTier <= user.currentTier) {
        throw new BadRequestException("No higher tier available");
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          furBalance: { decrement: cost },
          tierBoostTier: nextTier,
          tierBoostUntil: endOfDay,
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: "TIER_BOOST",
          amount: cost,
          currency: "FUR",
          status: "COMPLETED",
          meta: { tier: nextTier, until: endOfDay.toISOString(), kind: "tier_boost" },
        },
      });

      return { tier: nextTier, until: endOfDay };
    });
  }
}
