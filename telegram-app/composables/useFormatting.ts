export const useFormatting = () => {
  const formatAmount = (value: any, decimals = 1) => {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) return (0).toFixed(decimals);
    return numeric.toFixed(decimals);
  };

  const formatAmountOrPlaceholder = (
    value: any,
    hasFunds: boolean,
    decimals = 1,
    placeholder = "—",
  ) => {
    if (!hasFunds) return placeholder;
    return formatAmount(value, decimals);
  };

  const normalizeCurrency = (currency: any) => {
    const raw = String(currency || "USDT").toUpperCase();
    return raw === "USDT_TRX" ? "USDT" : raw;
  };

  const displayCurrency = (currency: any) => normalizeCurrency(currency);

  const calculateCompound = (amount: number, percent: number, days: number) => {
    if (!Number.isFinite(amount) || !Number.isFinite(percent) || !Number.isFinite(days)) return 0;
    return amount * Math.pow(1 + percent / 100, days);
  };

  return {
    formatAmount,
    formatAmountOrPlaceholder,
    normalizeCurrency,
    displayCurrency,
    calculateCompound,
  };
};
