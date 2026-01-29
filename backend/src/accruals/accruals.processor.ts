import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TelegramNotificationService } from "../notifications/telegram-notification.service";
import { getDailyPercentForTier } from "../tiers/tier.config";
import { AccrualsService } from "./accruals.service";

@Injectable()
export class AccrualsProcessor {
  private readonly logger = new Logger(AccrualsProcessor.name);

  constructor(
    private readonly accrualsService: AccrualsService,
    private readonly prisma: PrismaService,
    private readonly notifications: TelegramNotificationService,
  ) {}

  @Cron("0 0 * * *")
  async handleDailyAccrualJob() {
    this.logger.log("Running daily accrual job");
    try {
      await this.accrualsService.runDailyAccruals();
    } catch (err: any) {
      this.logger.error(`Daily accrual job failed: ${err?.message || err}`);
    }
  }

  @Cron("*/1 * * * *")
  async handleMaturedStakes() {
    try {
      await this.accrualsService.processMaturedStakes();
    } catch (err: any) {
      this.logger.error(`Matured stake processing failed: ${err?.message || err}`);
    }
  }

  @Cron("5 0 * * *")
  async handleDailyProfitReport() {
    try {
      const now = new Date();
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const profitByUser = await this.prisma.accrual.groupBy({
        by: ["userId"],
        where: {
          date: { gte: from, lt: now },
        },
        _sum: { amount: true },
      });

      const totals = new Map<string, Prisma.Decimal>();
      for (const item of profitByUser) {
        totals.set(item.userId, new Prisma.Decimal(item._sum.amount || 0));
      }

      const users = await this.prisma.user.findMany({
        where: {
          notifyDailyProfit: true,
          stakedBalance: { gt: 0 },
        },
        select: { id: true, telegramId: true, currentTier: true, stakedBalance: true },
      });

      for (const user of users) {
        const total = totals.get(user.id) || new Prisma.Decimal(0);
        const dailyPercent = getDailyPercentForTier(user.currentTier);
        const message = [
          "📈 Daily Profit",
          `+${total.toFixed(2)} USDT credited in the last 24h`,
          `Daily rate: ${dailyPercent}%`,
          `In work: ${Number(user.stakedBalance).toFixed(2)} USDT`,
        ].join("\n");

        await this.notifications.sendMessage(user.telegramId, message);
      }
    } catch (err: any) {
      this.logger.error(`Daily profit report job failed: ${err?.message || err}`);
    }
  }
}
