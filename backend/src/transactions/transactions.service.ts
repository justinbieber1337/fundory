import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByUser(userId: string, page = 1, pageSize = 10) {
    return this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }
}
