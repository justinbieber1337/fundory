import { useI18n } from "./useI18n";
import { useFormatting } from "./useFormatting";

type SignOptions = {
  failedWithdrawIsPlus?: boolean;
};

export const useTransactionUtils = () => {
  const { t } = useI18n();
  const { formatAmount, normalizeCurrency, displayCurrency } = useFormatting();

  const txType = (item: any) => String(item?.type || "").toLowerCase();

  const statusClass = (status: string) => {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "confirmed" || normalized === "completed") return "tx-status--ok";
    if (normalized === "failed" || normalized === "canceled") return "tx-status--bad";
    return "tx-status--pending";
  };

  const txTitle = (item: any) => {
    const type = txType(item);
    if (item?.meta?.kind === "claim") return t("common.reward");
    if (item?.meta?.kind === "swap" || type === "swap") return t("common.swap");
    if (type === "deposit_in" || type === "deposit") return t("common.deposit");
    if (type === "withdraw_out" || type === "withdraw") return t("common.withdraw");
    if (type === "tier_boost") return t("common.tierBoost");
    if (type === "referral_bonus" || type === "accrual") return t("common.reward");
    return t("common.transaction");
  };

  const txSign = (item: any, options: SignOptions = {}) => {
    const { failedWithdrawIsPlus = true } = options;
    const type = txType(item);
    const status = String(item?.status || "").toLowerCase();
    const isWithdraw = type === "withdraw_out" || type === "withdraw";
    if (type === "tier_boost") return "-";
    if (!isWithdraw) return "+";
    if (failedWithdrawIsPlus && (status === "failed" || status === "canceled")) return "+";
    return "-";
  };

  const formatSignedAmount = (item: any, options?: SignOptions) => {
    const sign = txSign(item, options);
    return `${sign}${formatAmount(item?.amount ?? 0)}`;
  };

  const txIcon = (item: any) => {
    const status = String(item?.status || "").toLowerCase();
    if (status === "pending") return "⏳";
    const type = txType(item);
    if (item?.meta?.kind === "claim") return "★";
    if (item?.meta?.kind === "swap" || type === "swap") return "⇄";
    if (type === "withdraw_out" || type === "withdraw") return "↙";
    if (type === "deposit_in" || type === "deposit") return "↗";
    if (type === "tier_boost") return "⬆";
    if (type === "referral_bonus" || type === "accrual") return "★";
    return "•";
  };

  const txTokenClass = (item: any) => {
    const currency = normalizeCurrency(item?.currency).toLowerCase();
    return currency === "fur" ? "fur" : "usdt";
  };

  const txTokenLabel = (item: any) => (txTokenClass(item) === "fur" ? "F" : "U");

  return {
    formatAmount,
    normalizeCurrency,
    displayCurrency,
    statusClass,
    txTitle,
    txSign,
    formatSignedAmount,
    txIcon,
    txTokenClass,
    txTokenLabel,
  };
};
