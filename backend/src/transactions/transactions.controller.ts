import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, CurrentUserDecorator } from "../common/decorators/current-user.decorator";
import { TransactionsService } from "./transactions.service";

@Controller("transactions")
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  list(
    @CurrentUserDecorator() user: CurrentUser,
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "10",
  ) {
    return this.transactionsService.listByUser(user.userId, Number(page), Number(pageSize));
  }
}
