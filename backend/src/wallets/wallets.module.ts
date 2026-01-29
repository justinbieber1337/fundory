import { Module, forwardRef } from "@nestjs/common";
import { WalletsService } from "./wallets.service";
import { WalletsController } from "./wallets.controller";
import { TronModule } from "../tron/tron.module";

@Module({
  imports: [forwardRef(() => TronModule)],
  providers: [WalletsService],
  controllers: [WalletsController],
  exports: [WalletsService],
})
export class WalletsModule {}
