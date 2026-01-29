import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { AccrualsService } from "./accruals.service";
import { AccrualsProcessor } from "./accruals.processor";

@Module({
  imports: [NotificationsModule],
  providers: [AccrualsService, AccrualsProcessor],
  exports: [AccrualsService],
})
export class AccrualsModule {}
