import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, CurrentUserDecorator } from "../common/decorators/current-user.decorator";
import { TariffsService } from "./tariffs.service";

@Controller("tariffs")
export class TariffsController {
  constructor(private readonly tariffsService: TariffsService) {}

  @Get()
  list() {
    return this.tariffsService.listActive();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.tariffsService.getById(id);
  }

  @Post("boost")
  @UseGuards(JwtAuthGuard)
  purchaseBoost(@CurrentUserDecorator() user: CurrentUser) {
    return this.tariffsService.purchaseNextTierBoost(user.userId);
  }
}
