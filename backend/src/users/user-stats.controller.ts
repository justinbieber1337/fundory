import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, CurrentUserDecorator } from "../common/decorators/current-user.decorator";
import { UsersService } from "./users.service";

@Controller("user")
@UseGuards(JwtAuthGuard)
export class UserStatsController {
  constructor(private readonly usersService: UsersService) {}

  @Get("stats")
  stats(@CurrentUserDecorator() user: CurrentUser) {
    return this.usersService.getStats(user.userId);
  }
}
