import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, CurrentUserDecorator } from "../common/decorators/current-user.decorator";
import { WithdrawalsService } from "./withdrawals.service";
import { CreateWithdrawalDto } from "./dto/create-withdrawal.dto";

@Controller("withdrawals")
@UseGuards(JwtAuthGuard)
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  @Post("request")
  request(@CurrentUserDecorator() user: CurrentUser, @Body() dto: CreateWithdrawalDto) {
    return this.withdrawalsService.createRequest(user.userId, dto);
  }

  @Post()
  create(@CurrentUserDecorator() user: CurrentUser, @Body() dto: CreateWithdrawalDto) {
    return this.withdrawalsService.createRequest(user.userId, dto);
  }
}
