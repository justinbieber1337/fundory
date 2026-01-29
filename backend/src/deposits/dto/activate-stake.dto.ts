import { IsIn, IsNumber, IsOptional, Min } from "class-validator";

export class ActivateStakeDto {
  @IsNumber()
  @IsIn([15, 30, 60])
  durationDays!: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;
}
