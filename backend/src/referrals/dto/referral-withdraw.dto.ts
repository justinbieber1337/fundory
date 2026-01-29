import { IsNumber } from "class-validator";

export class ReferralWithdrawDto {
  @IsNumber()
  amount!: number;
}
