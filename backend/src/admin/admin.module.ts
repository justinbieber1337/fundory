import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { TariffsModule } from "../tariffs/tariffs.module";
import { WithdrawalsModule } from "../withdrawals/withdrawals.module";
import { PrismaService } from "../prisma/prisma.service";

@Module({
  imports: [TariffsModule, WithdrawalsModule],
  controllers: [AdminController],
  providers: [PrismaService],
})
export class AdminModule {}
