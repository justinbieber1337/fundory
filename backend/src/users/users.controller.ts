import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, UnauthorizedException } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, CurrentUserDecorator } from "../common/decorators/current-user.decorator";
import { UsersService } from "./users.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { CreatePayoutAddressDto } from "./dto/create-payout-address.dto";

@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  async me(@CurrentUserDecorator() user: CurrentUser) {
    const profile = await this.usersService.getById(user.userId);
    if (!profile) {
      throw new UnauthorizedException("User not found");
    }
    return profile;
  }

  @Get("me/recalculate-tier")
  async meWithTier(@CurrentUserDecorator() user: CurrentUser) {
    await this.usersService.recalculateTier(user.userId);
    const profile = await this.usersService.getById(user.userId);
    if (!profile) {
      throw new UnauthorizedException("User not found");
    }
    return profile;
  }

  @Patch("me")
  async update(@CurrentUserDecorator() user: CurrentUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  @Get("payout-addresses")
  listAddresses(@CurrentUserDecorator() user: CurrentUser) {
    return this.usersService.listPayoutAddresses(user.userId);
  }

  @Post("payout-addresses")
  addAddress(@CurrentUserDecorator() user: CurrentUser, @Body() dto: CreatePayoutAddressDto) {
    return this.usersService.addPayoutAddress(user.userId, dto.address, dto.label);
  }

  @Delete("payout-addresses/:id")
  removeAddress(@CurrentUserDecorator() user: CurrentUser, @Param("id") id: string) {
    return this.usersService.removePayoutAddress(user.userId, id);
  }
}
