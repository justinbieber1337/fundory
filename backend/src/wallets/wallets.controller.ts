import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, CurrentUserDecorator } from "../common/decorators/current-user.decorator";
import { WalletsService } from "./wallets.service";
import { TronScanner } from "../tron/tron.scanner";

@Controller("wallets")
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(
    private readonly walletsService: WalletsService,
    private readonly tronScanner: TronScanner,
  ) {}

  @Get("deposit")
  async getDepositWallet(@CurrentUserDecorator() user: CurrentUser) {
    return this.walletsService.getOrCreateDepositWallet(user.userId);
  }

  @Post("deposit/scan")
  async scanDeposit(@CurrentUserDecorator() user: CurrentUser) {
    return this.tronScanner.scanDepositsForUser(user.userId);
  }
}
