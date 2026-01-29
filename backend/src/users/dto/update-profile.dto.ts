import { IsBoolean, IsOptional, IsString } from "class-validator";

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  language?: string;

  @IsBoolean()
  @IsOptional()
  notifyDailyProfit?: boolean;

  @IsBoolean()
  @IsOptional()
  notifyDeposit?: boolean;

  @IsBoolean()
  @IsOptional()
  notifyWithdraw?: boolean;

  @IsBoolean()
  @IsOptional()
  autoReinvest?: boolean;
}
