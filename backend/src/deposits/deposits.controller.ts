import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, CurrentUserDecorator } from "../common/decorators/current-user.decorator";
import { DepositsService } from "./deposits.service";
import { CreateDepositDto } from "./dto/create-deposit.dto";
import { ActivateStakeDto } from "./dto/activate-stake.dto";
import { UpdateAutoReinvestDto } from "./dto/update-auto-reinvest.dto";

@Controller("deposits")
@UseGuards(JwtAuthGuard)
export class DepositsController {
  constructor(private readonly depositsService: DepositsService) {}

  @Get()
  list(@CurrentUserDecorator() user: CurrentUser) {
    return this.depositsService.listByUser(user.userId);
  }

  @Post()
  create(@CurrentUserDecorator() user: CurrentUser, @Body() dto: CreateDepositDto) {
    return this.depositsService.create(user.userId, dto);
  }

  @Post(":id/stake")
  activateStake(
    @CurrentUserDecorator() user: CurrentUser,
    @Param("id") id: string,
    @Body() dto: ActivateStakeDto,
  ) {
    return this.depositsService.activateStake(user.userId, id, dto);
  }

  @Post(":id/auto-reinvest")
  updateAutoReinvest(
    @CurrentUserDecorator() user: CurrentUser,
    @Param("id") id: string,
    @Body() dto: UpdateAutoReinvestDto,
  ) {
    return this.depositsService.updateAutoReinvest(user.userId, id, dto.autoReinvest);
  }

  @Post(":id/unstake")
  emergencyUnstake(@CurrentUserDecorator() user: CurrentUser, @Param("id") id: string) {
    return this.depositsService.emergencyUnstake(user.userId, id);
  }
}
