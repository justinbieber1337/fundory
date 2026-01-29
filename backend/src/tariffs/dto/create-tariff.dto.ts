import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateTariffDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  monthlyPercent!: number;

  @IsString()
  @IsOptional()
  accrualPeriod?: string;

  @IsNumber()
  minDeposit!: number;

  @IsNumber()
  @IsOptional()
  maxDeposit?: number;

  @IsNumber()
  @IsOptional()
  termDays?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
