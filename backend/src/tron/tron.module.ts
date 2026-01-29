import { Module, forwardRef } from "@nestjs/common";
import { TronService } from "./tron.service";
import { TronScanner } from "./tron.scanner";
import { TronSweeper } from "./tron.sweeper";
import { UsersModule } from "../users/users.module";
import { TariffsModule } from "../tariffs/tariffs.module";
import { WalletsModule } from "../wallets/wallets.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [UsersModule, TariffsModule, forwardRef(() => WalletsModule), NotificationsModule],
  providers: [TronService, TronScanner, TronSweeper],
  exports: [TronService, TronScanner],
})
export class TronModule {}
