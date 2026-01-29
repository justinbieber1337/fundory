import { IsNotEmpty, IsNumber, IsString } from "class-validator";

export class CreateDepositDto {
  @IsString()
  @IsNotEmpty()
  tariffId!: string;

  @IsNumber()
  amount!: number;
}
