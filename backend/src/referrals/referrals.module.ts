import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { ReferralsService } from "./referrals.service";
import { ReferralsController } from "./referrals.controller";
import { ReferralsProcessor } from "./referrals.processor";

@Module({
  imports: [NotificationsModule],
  providers: [ReferralsService, ReferralsProcessor],
  controllers: [ReferralsController],
  exports: [ReferralsService],
})
export class ReferralsModule {}
