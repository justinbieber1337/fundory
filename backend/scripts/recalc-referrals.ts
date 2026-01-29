import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const MIN_DEPOSIT = new Prisma.Decimal(process.env.REFERRAL_MIN_DEPOSIT || "175");
const RAW_FUR_RATE = new Prisma.Decimal(process.env.FUR_USDT_RATE || "0.45");
const FUR_RATE = RAW_FUR_RATE.greaterThan(0) ? RAW_FUR_RATE : new Prisma.Decimal(1);

const run = async () => {
  const referrals = await prisma.referral.findMany({
    select: { id: true, referrerId: true, referredId: true },
  });
  const referralMap = new Map<string, string>();
  const referrerMap = new Map<string, string[]>();
  for (const ref of referrals) {
    referralMap.set(ref.referredId, ref.referrerId);
    const list = referrerMap.get(ref.referrerId) || [];
    list.push(ref.referredId);
    referrerMap.set(ref.referrerId, list);
  }

  const deposits = await prisma.deposit.findMany({
    where: { status: "active" },
    select: { id: true, userId: true, amount: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const users = await prisma.user.findMany({
    select: { id: true },
  });

  const activeSetByReferrer = new Map<string, Set<string>>();
  const teamTurnover = new Map<string, Prisma.Decimal>();
  const bonusTotals = new Map<string, Prisma.Decimal>();
  const bonusTransactions: Array<{
    userId: string;
    amount: Prisma.Decimal;
    meta: any;
  }> = [];
  const referralHasDeposit = new Map<string, boolean>();

  const addBonus = (userId: string, amount: Prisma.Decimal, meta: any) => {
    if (amount.lessThanOrEqualTo(0)) return;
    const current = bonusTotals.get(userId) || new Prisma.Decimal(0);
    bonusTotals.set(userId, current.add(amount));
    bonusTransactions.push({ userId, amount, meta });
  };

  const toFur = (usdtAmount: Prisma.Decimal) => usdtAmount.div(FUR_RATE);

  const addTurnover = (userId: string, amount: Prisma.Decimal) => {
    const current = teamTurnover.get(userId) || new Prisma.Decimal(0);
    teamTurnover.set(userId, current.add(amount));
  };

  for (const deposit of deposits) {
    const amount = new Prisma.Decimal(deposit.amount);
    if (amount.lessThan(MIN_DEPOSIT)) continue;

    const level1 = referralMap.get(deposit.userId);
    if (!level1) continue;

    const level2 = referralMap.get(level1);
    const level3 = level2 ? referralMap.get(level2) : undefined;
    const levels = [level1, level2, level3].filter(Boolean) as string[];

    const activeSet = activeSetByReferrer.get(level1) || new Set<string>();
    const wasActive = activeSet.has(deposit.userId);
    if (!wasActive) {
      activeSet.add(deposit.userId);
      activeSetByReferrer.set(level1, activeSet);
      referralHasDeposit.set(`${level1}:${deposit.userId}`, true);
    }

    for (const userId of levels) {
      addTurnover(userId, amount);
    }

    const percents = activeSet.size >= 4 ? [0.05, 0.025, 0.0075] : [0.025, 0.025, 0.0075];
    for (let i = 0; i < levels.length; i += 1) {
      const userId = levels[i];
      addBonus(userId, toFur(amount.mul(percents[i])), {
        referredId: deposit.userId,
        depositId: deposit.id,
        kind: "level_bonus",
        level: i + 1,
      });
    }

    if (activeSet.size >= 4) {
      addBonus(level1, toFur(amount.mul(0.0025)), {
        referredId: deposit.userId,
        depositId: deposit.id,
        kind: "active_ref_percent",
        level: 1,
      });
    }
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.transaction.deleteMany({ where: { type: "REFERRAL_BONUS", currency: "FUR" } });

    if (bonusTransactions.length) {
      const chunkSize = 500;
      for (let i = 0; i < bonusTransactions.length; i += chunkSize) {
        const slice = bonusTransactions.slice(i, i + chunkSize);
        await tx.transaction.createMany({
          data: slice.map((item) => ({
            userId: item.userId,
            type: "REFERRAL_BONUS",
            amount: item.amount,
            currency: "FUR",
            status: "COMPLETED",
            meta: item.meta,
          })),
        });
      }
    }

    const swaps = await tx.transaction.groupBy({
      by: ["userId"],
      where: { currency: "FUR", type: "SWAP" },
      _sum: { amount: true },
    });
    const withdraws = await tx.transaction.groupBy({
      by: ["userId"],
      where: { currency: "FUR", type: "WITHDRAW" },
      _sum: { amount: true },
    });
    const swapMap = new Map<string, Prisma.Decimal>();
    for (const item of swaps) {
      swapMap.set(item.userId, new Prisma.Decimal(item._sum.amount || 0));
    }
    const withdrawMap = new Map<string, Prisma.Decimal>();
    for (const item of withdraws) {
      withdrawMap.set(item.userId, new Prisma.Decimal(item._sum.amount || 0));
    }

    for (const user of users) {
      const bonusTotal = bonusTotals.get(user.id) || new Prisma.Decimal(0);
      const claimed = swapMap.get(user.id) || new Prisma.Decimal(0);
      const withdrawn = withdrawMap.get(user.id) || new Prisma.Decimal(0);
      const pending = Prisma.Decimal.max(bonusTotal.sub(claimed).sub(withdrawn), new Prisma.Decimal(0));

      await tx.user.update({
        where: { id: user.id },
        data: {
          furPending: pending,
          teamTurnoverSum: teamTurnover.get(user.id) || new Prisma.Decimal(0),
        },
      });
    }

    for (const ref of referrals) {
      const key = `${ref.referrerId}:${ref.referredId}`;
      await tx.referral.update({
        where: { id: ref.id },
        data: { hasDeposit: referralHasDeposit.get(key) || false },
      });
    }
  });
};

run()
  .catch((err) => {
    console.error("recalc-referrals failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
