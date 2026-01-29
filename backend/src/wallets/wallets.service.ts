import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { TronService } from "../tron/tron.service";

@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tronService: TronService,
    private readonly config: ConfigService,
  ) {}

  async getOrCreateDepositWallet(userId: string) {
    const existing = await this.prisma.wallet.findFirst({
      where: { userId, type: "deposit_wallet" },
    });
    if (existing) return existing;

    const wallet = await this.tronService.generateWallet();
    return this.prisma.wallet.create({
      data: {
        userId,
        address: wallet.address,
        privateKey: this.encryptPrivateKey(wallet.privateKey),
        type: "deposit_wallet",
      },
    });
  }

  async getDepositWallet(userId: string) {
    return this.prisma.wallet.findFirst({
      where: { userId, type: "deposit_wallet" },
    });
  }

  decryptWalletPrivateKey(encrypted: string) {
    return this.decryptPrivateKey(encrypted);
  }

  private getEncryptionKey() {
    const secret = this.config.get<string>("ENCRYPTION_KEY");
    if (!secret) {
      throw new Error("ENCRYPTION_KEY is not set");
    }
    return createHash("sha256").update(secret).digest();
  }

  private encryptPrivateKey(value: string) {
    const key = this.getEncryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("base64")}:${encrypted.toString("base64")}:${tag.toString("base64")}`;
  }

  private decryptPrivateKey(payload: string) {
    const [ivBase64, dataBase64, tagBase64] = payload.split(":");
    if (!ivBase64 || !dataBase64 || !tagBase64) {
      throw new Error("Invalid encrypted payload");
    }
    const key = this.getEncryptionKey();
    const iv = Buffer.from(ivBase64, "base64");
    const data = Buffer.from(dataBase64, "base64");
    const tag = Buffer.from(tagBase64, "base64");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  }
}
