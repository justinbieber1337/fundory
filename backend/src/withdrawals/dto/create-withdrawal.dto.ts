import { IsNotEmpty, IsNumber, IsString, Min } from "class-validator";

export class CreateWithdrawalDto {
  @IsNumber()
  @Min(10)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  address!: string;
}
