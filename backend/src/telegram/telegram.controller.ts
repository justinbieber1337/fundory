import { Body, Controller, Headers, Post } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { WithdrawalsService } from "../withdrawals/withdrawals.service";

@Controller("telegram")
export class TelegramController {
  constructor(
    private readonly config: ConfigService,
    private readonly withdrawalsService: WithdrawalsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("webhook")
  async webhook(
    @Body() update: any,
    @Headers("x-telegram-bot-api-secret-token") secret?: string,
  ) {
    const expectedSecret = this.config.get<string>("TELEGRAM_WEBHOOK_SECRET");
    if (expectedSecret && secret !== expectedSecret) {
      return { ok: true };
    }

    const message = update?.message;
    if (message?.text?.startsWith("/start")) {
      const chatId = message?.chat?.id;
      if (!chatId) return { ok: true };
      const from = message?.from || {};
      const name = from?.first_name || from?.username || "there";
      await this.sendWelcome(chatId, name);
      return { ok: true };
    }

    const callback = update?.callback_query;
    if (!callback) return { ok: true };

    const adminId = this.config.get<string>("ADMIN_TELEGRAM_ID");
    const fromId = String(callback?.from?.id || "");
    if (adminId && fromId !== String(adminId)) {
      await this.answerCallback(callback.id, "Not authorized", true);
      return { ok: true };
    }

    const data = String(callback?.data || "");
    const [kind, action, transactionId] = data.split(":");
    if (kind !== "withdraw" || !transactionId) return { ok: true };

    const existing = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!existing || existing.type !== "WITHDRAW") {
      await this.answerCallback(callback.id, "Withdrawal not found", true);
      return { ok: true };
    }
    if (existing.status === "COMPLETED" || existing.status === "FAILED") {
      const statusLine = existing.status === "COMPLETED" ? "✅ Approved" : "❌ Rejected";
      await this.answerCallback(callback.id, "Already processed");
      await this.editMessage(callback, statusLine);
      return { ok: true };
    }

    if (action === "approve") {
      await this.withdrawalsService.updateStatus(transactionId, "COMPLETED");
      await this.answerCallback(callback.id, "Approved");
      await this.editMessage(callback, "✅ Approved");
    } else if (action === "reject") {
      await this.withdrawalsService.updateStatus(transactionId, "FAILED");
      await this.answerCallback(callback.id, "Rejected");
      await this.editMessage(callback, "❌ Rejected");
    }

    return { ok: true };
  }

  private async answerCallback(callbackId: string, text: string, alert = false) {
    const botToken = this.config.get<string>("TELEGRAM_BOT_TOKEN");
    if (!botToken || !callbackId) return;
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackId, text, show_alert: alert }),
    });
  }

  private async editMessage(callback: any, statusLine: string) {
    const botToken = this.config.get<string>("TELEGRAM_BOT_TOKEN");
    const message = callback?.message;
    if (!botToken || !message?.chat?.id || !message?.message_id) return;
    const baseText = String(message.text || "Withdrawal request");
    const text = `${baseText}\n\nStatus: ${statusLine}`;
    await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: message.chat.id,
        message_id: message.message_id,
        text,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [] },
      }),
    });
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private async sendWelcome(chatId: string | number, name: string) {
    const botToken = this.config.get<string>("TELEGRAM_BOT_TOKEN");
    if (!botToken || !chatId) return;

    const safeName = this.escapeHtml(String(name || "there"));
    const webAppUrl = this.config.get<string>("TELEGRAM_WEBAPP_URL") || "https://app.fundory.cc";
    const communityUrl = this.config.get<string>("TELEGRAM_COMMUNITY_URL") || "https://t.me/fundory";
    const supportUrl = this.config.get<string>("TELEGRAM_SUPPORT_URL") || "https://t.me/fundory_support";

    const text = [
      `🚀 Welcome to Fundory, ${safeName}!`,
      "Your gateway to automated passive income is now open.",
      "",
      "How to start:",
      "1️⃣ Deposit: Get your personal TRC20 address.",
      "2️⃣ Stake: Choose your term and start earning up to 1% daily.",
      "3️⃣ Grow: Use compound interest to accelerate your wealth.",
      "",
      "💰 Your current status: Tier 0 (0.25% daily)",
      "Tap the button below to launch the app and make your first move!",
    ].join("\n");

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🚀 Launch Fundory App", web_app: { url: webAppUrl } }],
            [
              { text: "📢 Join Community", url: communityUrl },
              { text: "🛠 Support", url: supportUrl },
            ],
          ],
        },
      }),
    });
  }
}
