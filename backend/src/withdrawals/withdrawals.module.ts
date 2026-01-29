import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { WithdrawalsService } from "./withdrawals.service";
import { WithdrawalsController } from "./withdrawals.controller";

@Module({
  imports: [NotificationsModule],
  providers: [WithdrawalsService],
  controllers: [WithdrawalsController],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
