import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class TelegramAuthDto {
  @IsString()
  @IsNotEmpty()
  initData!: string;

  @IsString()
  @IsOptional()
  startParam?: string;
}
