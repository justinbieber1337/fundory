import { BadRequestException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { createHmac } from "crypto";
import { UsersService } from "../users/users.service";
import { WalletsService } from "../wallets/wallets.service";

type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly usersService: UsersService,
    private readonly walletsService: WalletsService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async telegramWebapp(initData: string, startParam?: string) {
    const parsed = this.parseInitData(initData);
    const isValid = this.verifyInitData(initData);
    const parsedUser = parsed.user as TelegramUser | undefined;
    this.logger.log(
      `telegram-webapp initData userId=${parsedUser?.id ?? "none"} valid=${isValid}`,
    );
    if (!isValid) {
      throw new UnauthorizedException("Invalid Telegram initData");
    }

    const user = parsedUser;
    const parsedStart = typeof parsed.start_param === "string" ? parsed.start_param : "";
    const effectiveStart = startParam || parsedStart;
    const refCode = effectiveStart?.startsWith("ref_") ? effectiveStart : undefined;
    if (!user?.id) {
      throw new BadRequestException("Missing Telegram user");
    }

    const found = await this.usersService.findOrCreateFromTelegram(user, refCode);
    await this.walletsService.getOrCreateDepositWallet(found.id);
    const token = await this.jwtService.signAsync({
      sub: found.id,
      telegramId: found.telegramId,
    });

    return { token, user: found };
  }

  private parseInitData(initData: string) {
    const params = new URLSearchParams(initData);
    const result: Record<string, unknown> = {};
    for (const [key, value] of params.entries()) {
      if (key === "user") {
        result[key] = JSON.parse(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  private verifyInitData(initData: string) {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    params.delete("hash");
    const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");

    const botToken = this.config.get<string>("TELEGRAM_BOT_TOKEN");
    if (!botToken) return false;

    const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
    const signature = createHmac("sha256", secret).update(dataCheckString).digest("hex");
    return signature === hash;
  }
}
