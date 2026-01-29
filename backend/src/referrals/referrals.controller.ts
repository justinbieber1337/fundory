import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { Param } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, CurrentUserDecorator } from "../common/decorators/current-user.decorator";
import { ReferralsService } from "./referrals.service";
import { ReferralWithdrawDto } from "./dto/referral-withdraw.dto";
import { ConfigService } from "@nestjs/config";

@Controller("referrals")
@UseGuards(JwtAuthGuard)
export class ReferralsController {
  constructor(
    private readonly referralsService: ReferralsService,
    private readonly config: ConfigService,
  ) {}

  @Get("stats")
  stats(@CurrentUserDecorator() user: CurrentUser) {
    const botUsername = this.config.get<string>("TELEGRAM_BOT_USERNAME", "your_bot");
    return this.referralsService.stats(user.userId, botUsername);
  }

  @Get("leaderboard")
  leaderboard() {
    return this.referralsService.leaderboard();
  }

  @Get("children/:userId")
  children(@CurrentUserDecorator() user: CurrentUser, @Param("userId") userId: string) {
    return this.referralsService.children(user.userId, userId);
  }

  @Post("withdraw")
  withdraw(@CurrentUserDecorator() user: CurrentUser, @Body() dto: ReferralWithdrawDto) {
    return this.referralsService.withdrawReferral(user.userId, dto.amount);
  }

  @Post("swap")
  swap(@CurrentUserDecorator() user: CurrentUser) {
    return this.referralsService.claimFur(user.userId);
  }

  @Post("claim")
  claim(@CurrentUserDecorator() user: CurrentUser) {
    return this.referralsService.claimFur(user.userId);
  }
}
