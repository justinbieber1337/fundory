import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type TelegramExtra = Record<string, unknown>;

@Injectable()
export class TelegramNotificationService {
  private readonly logger = new Logger(TelegramNotificationService.name);

  constructor(private readonly config: ConfigService) {}

  async sendMessage(chatId: string | null | undefined, text: string, extra?: TelegramExtra) {
    const botToken = this.config.get<string>("TELEGRAM_BOT_TOKEN");
    if (!botToken || !chatId) return;
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...extra }),
      });
    } catch (err: any) {
      this.logger.warn(`Failed to send Telegram message: ${err?.message || err}`);
    }
  }

  async sendAdminMessage(text: string, extra?: TelegramExtra) {
    const adminId = this.config.get<string>("ADMIN_TELEGRAM_ID");
    if (!adminId) return;
    await this.sendMessage(adminId, text, extra);
  }
}
