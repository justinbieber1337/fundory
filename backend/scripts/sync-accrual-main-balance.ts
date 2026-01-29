import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const run = async () => {
  const groups = await prisma.transaction.groupBy({
    by: ["userId"],
    where: {
      type: "ACCRUAL",
      status: "COMPLETED",
      currency: "USDT_TRX",
    },
    _sum: { amount: true },
  });

  for (const group of groups) {
    const raw = group._sum.amount;
    if (!raw) continue;
    const amount = new Prisma.Decimal(raw);
    if (amount.lessThanOrEqualTo(0)) continue;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: group.userId },
        data: { mainBalance: { increment: amount } },
      }),
      prisma.transaction.updateMany({
        where: { userId: group.userId, type: "ACCRUAL", currency: "USDT_TRX" },
        data: { currency: "USDT" },
      }),
    ]);
  }
};

run()
  .catch((err) => {
    console.error("sync-accrual-main-balance failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
