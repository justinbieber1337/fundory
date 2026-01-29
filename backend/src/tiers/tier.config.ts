import { Prisma } from "@prisma/client";

type TierRule = {
  tier: number;
  minPersonal: number;
  minTeam: number;
  dailyPercent: number;
  monthlyCompoundPercent: number;
};

type TierInfo = {
  tier: number;
  minPersonal: number;
  minTeam: number;
  dailyPercent: number;
  monthlyCompoundPercent: number | null;
};

export const TIER_RULES: TierRule[] = [
  { tier: 1, minPersonal: 1500, minTeam: 2500, dailyPercent: 0.2, monthlyCompoundPercent: 6.2 },
  { tier: 2, minPersonal: 3000, minTeam: 6000, dailyPercent: 0.25, monthlyCompoundPercent: 7.8 },
  { tier: 3, minPersonal: 7000, minTeam: 15000, dailyPercent: 0.3, monthlyCompoundPercent: 9.4 },
  { tier: 4, minPersonal: 15000, minTeam: 30000, dailyPercent: 0.4, monthlyCompoundPercent: 12.7 },
  { tier: 5, minPersonal: 30000, minTeam: 60000, dailyPercent: 0.5, monthlyCompoundPercent: 16.1 },
  { tier: 6, minPersonal: 60000, minTeam: 120000, dailyPercent: 0.6, monthlyCompoundPercent: 19.7 },
  { tier: 7, minPersonal: 100000, minTeam: 250000, dailyPercent: 0.7, monthlyCompoundPercent: 23.3 },
  { tier: 8, minPersonal: 200000, minTeam: 500000, dailyPercent: 0.8, monthlyCompoundPercent: 27.0 },
  { tier: 9, minPersonal: 350000, minTeam: 900000, dailyPercent: 0.9, monthlyCompoundPercent: 30.8 },
  { tier: 10, minPersonal: 500000, minTeam: 1500000, dailyPercent: 1.0, monthlyCompoundPercent: 34.8 },
];

export const TIER_ZERO: TierInfo = {
  tier: 0,
  minPersonal: 0,
  minTeam: 0,
  monthlyCompoundPercent: 4.6,
  dailyPercent: 0.15,
};

export const getAllTiers = (): TierInfo[] => {
  return [
    TIER_ZERO,
    ...TIER_RULES.map((rule) => ({
      tier: rule.tier,
      minPersonal: rule.minPersonal,
      minTeam: rule.minTeam,
      dailyPercent: rule.dailyPercent,
      monthlyCompoundPercent: rule.monthlyCompoundPercent,
    })),
  ];
};

export const resolveTier = (personalDeposit: Prisma.Decimal, teamTurnover: Prisma.Decimal) => {
  const personal = new Prisma.Decimal(personalDeposit);
  const team = new Prisma.Decimal(teamTurnover);
  for (const rule of [...TIER_RULES].sort((a, b) => b.tier - a.tier)) {
    if (personal.greaterThanOrEqualTo(rule.minPersonal) || team.greaterThanOrEqualTo(rule.minTeam)) {
      return rule.tier;
    }
  }
  return 0;
};

export const getMonthlyPercentForTier = (tier: number) => {
  if (tier <= 0) return 0;
  const rule = TIER_RULES.find((item) => item.tier === tier);
  return rule ? rule.monthlyCompoundPercent : 0;
};

export const calculateDailyAccrual = (amount: Prisma.Decimal, tier: number) => {
  const base = new Prisma.Decimal(amount);
  if (tier <= 0) {
    return base.mul(TIER_ZERO.dailyPercent).div(100);
  }
  const rule = TIER_RULES.find((item) => item.tier === tier);
  const dailyPercent = new Prisma.Decimal(rule?.dailyPercent ?? TIER_ZERO.dailyPercent);
  return base.mul(dailyPercent).div(100);
};

export const getDailyPercentForTier = (tier: number) => {
  if (tier <= 0) return TIER_ZERO.dailyPercent;
  const rule = TIER_RULES.find((item) => item.tier === tier);
  return rule ? rule.dailyPercent : TIER_ZERO.dailyPercent;
};
