import { Prisma, PrismaClient } from "@prisma/client";
import { resolveTier } from "../src/tiers/tier.config";

type Tariff = { id: string; minDeposit: Prisma.Decimal };

const prisma = new PrismaClient();

const pickTariff = (activeTariffs: Tariff[], amount: Prisma.Decimal) => {
  if (!activeTariffs.length) return null;
  const sorted = [...activeTariffs].sort((a, b) => Number(a.minDeposit) - Number(b.minDeposit));
  let selected = sorted[0];
  for (const tariff of sorted) {
    if (amount.greaterThanOrEqualTo(tariff.minDeposit)) {
      selected = tariff;
    }
  }
  return selected;
};

const recalculateTier = async (userId: string, tx: Prisma.TransactionClient) => {
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const nextTier = resolveTier(
    new Prisma.Decimal(user.personalDepositSum),
    new Prisma.Decimal(user.teamTurnoverSum),
  );
  if (user.currentTier !== nextTier) {
    await tx.user.update({ where: { id: userId }, data: { currentTier: nextTier } });
  }
};

const applyAdminDeposit = async (
  user: { id: string; mainBalance: Prisma.Decimal },
  activeTariffs: Tariff[],
) => {
  const amount = new Prisma.Decimal(user.mainBalance);
  if (!amount.greaterThan(0)) return false;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        stakedBalance: { increment: amount },
        personalDepositSum: { increment: amount },
      },
    });

    const tariff = pickTariff(activeTariffs, amount);
    let depositId: string | null = null;
    if (tariff) {
      const created = await tx.deposit.create({
        data: {
          userId: user.id,
          tariffId: tariff.id,
          amount,
          status: "active",
        },
      });
      depositId = created.id;
    }

    await tx.transaction.create({
      data: {
        userId: user.id,
        type: "DEPOSIT",
        amount,
        currency: "USDT",
        status: "COMPLETED",
        meta: { source: "admin_migration", ...(depositId ? { depositId } : {}) },
      },
    });

    await recalculateTier(user.id, tx);
  });

  return true;
};

const main = async () => {
  const activeTariffs = await prisma.tariff.findMany({ where: { isActive: true } });
  const users = await prisma.user.findMany();

  const depositsByUser = await prisma.deposit.groupBy({
    by: ["userId"],
    _count: { _all: true },
  });
  const depositCountMap = new Map(
    depositsByUser.map((item) => [item.userId, item._count._all]),
  );

  const usersWithDeposits = new Set<string>(
    depositsByUser.map((item) => item.userId),
  );

  let createdDeposits = 0;
  for (const user of users) {
    const hasDeposits = (depositCountMap.get(user.id) ?? 0) > 0;
    if (!hasDeposits && new Prisma.Decimal(user.mainBalance).greaterThan(0)) {
      const created = await applyAdminDeposit(user, activeTariffs);
      if (created) {
        createdDeposits += 1;
        usersWithDeposits.add(user.id);
      }
    }
  }

  if (usersWithDeposits.size > 0) {
    await prisma.referral.updateMany({
      where: { referredId: { in: Array.from(usersWithDeposits) }, hasDeposit: false },
      data: { hasDeposit: true },
    });
  }

  let updatedTiers = 0;
  for (const user of users) {
    const nextTier = resolveTier(
      new Prisma.Decimal(user.personalDepositSum),
      new Prisma.Decimal(user.teamTurnoverSum),
    );
    if (user.currentTier !== nextTier) {
      await prisma.user.update({
        where: { id: user.id },
        data: { currentTier: nextTier },
      });
      updatedTiers += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        usersChecked: users.length,
        createdDeposits,
        updatedTiers,
      },
      null,
      2,
    ),
  );
};

main()
  .catch((err) => {
    console.error("Refresh failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
