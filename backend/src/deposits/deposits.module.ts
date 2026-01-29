import { Module } from "@nestjs/common";
import { DepositsService } from "./deposits.service";
import { DepositsController } from "./deposits.controller";
import { TariffsModule } from "../tariffs/tariffs.module";
import { UsersModule } from "../users/users.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [TariffsModule, UsersModule, NotificationsModule],
  providers: [DepositsService],
  controllers: [DepositsController],
})
export class DepositsModule {}
