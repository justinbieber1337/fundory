import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ReferralsService } from "./referrals.service";

@Injectable()
export class ReferralsProcessor {
  private readonly logger = new Logger(ReferralsProcessor.name);

  constructor(private readonly referralsService: ReferralsService) {}

  @Cron("0 * * * *")
  async handleTurnoverRecalc() {
    try {
      const updated = await this.referralsService.recalculateTotalTurnover();
      this.logger.log(`Recalculated totalTurnover for ${updated} users`);
    } catch (err: any) {
      this.logger.error(`Total turnover recalculation failed: ${err?.message || err}`);
    }
  }
}
