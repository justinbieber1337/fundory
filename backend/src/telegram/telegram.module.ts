import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { WithdrawalsModule } from "../withdrawals/withdrawals.module";
import { TelegramController } from "./telegram.controller";

@Module({
  imports: [ConfigModule, WithdrawalsModule],
  controllers: [TelegramController],
})
export class TelegramModule {}
