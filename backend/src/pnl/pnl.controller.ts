import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, CurrentUserDecorator } from "../common/decorators/current-user.decorator";
import { PnlService } from "./pnl.service";

@Controller("user")
@UseGuards(JwtAuthGuard)
export class PnlController {
  constructor(private readonly pnlService: PnlService) {}

  @Get("pnl")
  pnl(@CurrentUserDecorator() user: CurrentUser) {
    return this.pnlService.getUserPnl(user.userId);
  }
}
