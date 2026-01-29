import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { WalletsModule } from "./wallets/wallets.module";
import { TariffsModule } from "./tariffs/tariffs.module";
import { DepositsModule } from "./deposits/deposits.module";
import { TransactionsModule } from "./transactions/transactions.module";
import { ReferralsModule } from "./referrals/referrals.module";
import { AccrualsModule } from "./accruals/accruals.module";
import { WithdrawalsModule } from "./withdrawals/withdrawals.module";
import { AdminModule } from "./admin/admin.module";
import { TronModule } from "./tron/tron.module";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { BalancesModule } from "./balances/balances.module";
import { TiersModule } from "./tiers/tiers.module";
import { PnlModule } from "./pnl/pnl.module";
import { TelegramModule } from "./telegram/telegram.module";
import { AdminToolsModule } from "./admin-tools/admin-tools.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    TronModule,
    AuthModule,
    UsersModule,
    WalletsModule,
    TariffsModule,
    DepositsModule,
    TransactionsModule,
    ReferralsModule,
    WithdrawalsModule,
    AccrualsModule,
    AdminModule,
    HealthModule,
    DashboardModule,
    BalancesModule,
    TiersModule,
    PnlModule,
    TelegramModule,
    AdminToolsModule,
  ],
})
export class AppModule {}
