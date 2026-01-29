import { IsNotEmpty, IsOptional, IsString, Matches } from "class-validator";

export class CreatePayoutAddressDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^T[1-9A-HJ-NP-Za-km-z]{33}$/, { message: "Invalid TRC20 address" })
  address!: string;

  @IsString()
  @IsOptional()
  label?: string;
}
