import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { UserStatsController } from "./user-stats.controller";

@Module({
  imports: [NotificationsModule],
  providers: [UsersService],
  controllers: [UsersController, UserStatsController],
  exports: [UsersService],
})
export class UsersModule {}
