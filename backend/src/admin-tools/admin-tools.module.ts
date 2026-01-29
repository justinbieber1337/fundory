import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AdminToolsController } from "./admin-tools.controller";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [ConfigModule, UsersModule],
  controllers: [AdminToolsController],
})
export class AdminToolsModule {}
