<template>
  <section class="page">
    <div class="section-title">{{ t("analytics.title") }}</div>
    <div v-if="loading" class="loading-wrap">
      <LoadingSpinner />
    </div>
    <div v-else-if="error" class="card">{{ error }}</div>
    <div v-else class="analytics-stack">
      <div class="stats-header">
        <div class="muted">{{ t("analytics.statsTitle") }}</div>
        <div class="stats-toggle">
          <button
            class="pill"
            :class="{ 'pill--active': statsUnit === 'USDT' }"
            @click="statsUnit = 'USDT'"
          >
            USDT
          </button>
          <button
            class="pill"
            :class="{ 'pill--active': statsUnit === 'FUR' }"
            @click="statsUnit = 'FUR'"
          >
            FUR
          </button>
        </div>
      </div>

      <div class="stat-grid" v-if="statsUnit === 'USDT'">
        <div class="stat-card">
          <div class="stat-top">{{ t("analytics.usdtStats") }}</div>
          <div class="stat-value">{{ formatAmountOrPlaceholder(todayProfit, hasFunds) }} USDT</div>
          <div class="stat-caption">{{ t("analytics.profitToday") }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-top">{{ t("analytics.usdtStats") }}</div>
          <div class="stat-value">{{ formatAmountOrPlaceholder(monthProfit, hasFunds) }} USDT</div>
          <div class="stat-caption">{{ t("analytics.profitMonth") }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-top">{{ t("analytics.usdtStats") }}</div>
          <div class="stat-value">{{ formatAmountOrPlaceholder(yearProfit, hasFunds) }} USDT</div>
          <div class="stat-caption">{{ t("analytics.profitYear") }}</div>
        </div>
      </div>

      <div class="stat-grid" v-else>
        <div class="stat-card">
          <div class="stat-top">{{ t("analytics.furStats") }}</div>
          <div class="stat-value">{{ formatAmountOrPlaceholder(furEarned, hasFunds) }} FUR</div>
          <div class="stat-caption">{{ t("analytics.furEarned") }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-top">{{ t("analytics.furStats") }}</div>
          <div class="stat-value">{{ formatAmountOrPlaceholder(furFrozen, hasFunds) }} FUR</div>
          <div class="stat-caption">{{ t("analytics.furFrozen") }}</div>
        </div>
      </div>

      <div v-if="hasFunds" class="card chart-card chart-card--equity">
        <div class="chart-header">
          <div class="muted">{{ equityTitle }}</div>
          <div class="stats-toggle">
            <button
              class="pill"
              :class="{ 'pill--active': equityGranularity === 'day' }"
              @click="equityGranularity = 'day'"
            >
              {{ t("analytics.day") }}
            </button>
            <button
              class="pill"
              :class="{ 'pill--active': equityGranularity === 'month' }"
              @click="equityGranularity = 'month'"
            >
              {{ t("analytics.month") }}
            </button>
          </div>
        </div>
        <ClientOnly>
          <apexchart
            height="180"
            type="bar"
            :options="equityOptions"
            :series="equitySeries"
          />
        </ClientOnly>
      </div>

      <div v-if="hasFunds" class="card chart-card chart-card--allocation">
        <div class="muted">{{ allocationTitle }}</div>
        <div class="allocation-grid">
          <ClientOnly>
            <apexchart
              height="190"
              type="donut"
              :options="allocationOptions"
              :series="allocationSeries"
            />
          </ClientOnly>
          <div class="allocation-legend">
            <div v-for="item in allocationLegend" :key="item.label" class="legend-item">
              <span class="legend-dot" :style="{ background: item.color }"></span>
              <span>{{ item.label }}</span>
              <span class="legend-value">
                {{ formatAmountOrPlaceholder(item.value, hasFunds) }} {{ item.unit }}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="card empty-banner">
        <div class="empty-title">{{ t("common.noFundsTitle") }}</div>
        <div class="muted">{{ t("common.noFundsText") }}</div>
        <button class="button button--primary button-full" @click="goDeposit">
          {{ t("common.startInvesting") }}
        </button>
      </div>

    </div>
  </section>
</template>

<script setup lang="ts">
const { apiFetch } = useApi();
const { token, loadToken } = useAuth();
const { t } = useI18n();
const { formatAmountOrPlaceholder } = useFormatting();

const loading = ref(true);
const error = ref<string | null>(null);
const balances = ref<any>(null);
const pnl = ref<any>(null);
const statsUnit = ref<"USDT" | "FUR">("USDT");
const equityGranularity = ref<"day" | "month">("day");

onMounted(async () => {
  loadToken();
  if (!token.value) return;
  try {
    const [balancesRes, pnlRes] = await Promise.all([
      apiFetch("/balances"),
      apiFetch("/user/pnl"),
    ]);
    balances.value = balancesRes;
    pnl.value = pnlRes;
  } catch (err: any) {
    error.value = err?.message || t("analytics.failed");
  } finally {
    loading.value = false;
  }
});

const inWork = computed(() => Number(balances.value?.inTariffs || 0));
const available = computed(() => Number(balances.value?.available || 0));
const furBalance = computed(() => Number(balances.value?.furBalance || 0));
const furRate = 0.5;
const furUsdtValue = computed(() => furBalance.value * furRate);
const todayProfit = computed(() => Number(pnl.value?.todayProfit ?? pnl.value?.yesterdayProfit ?? 0));
const monthProfit = computed(() => Number(pnl.value?.monthProfit || 0));
const yearProfit = computed(() => Number(pnl.value?.yearProfit || 0));

const furEarned = computed(() => Number(pnl.value?.furEarnedAllTime || 0));
const furFrozen = computed(() => Number(pnl.value?.furFrozen || 0));
const hasFunds = computed(
  () => available.value + inWork.value + furBalance.value + furEarned.value + furFrozen.value > 0,
);


const normalizedHistory = computed(() => {
  const items = statsUnit.value === "USDT" ? pnl.value?.usdtHistory : pnl.value?.furHistory;
  return normalizeHistory(items || []);
});
const historyDates = computed(() => normalizedHistory.value.labels);
const historyValues = computed(() => normalizedHistory.value.values);

const equitySeries = computed(() => [
  {
    name: statsUnit.value === "USDT" ? "USDT" : "FUR",
    data: historyValues.value,
  },
]);

const equityTitle = computed(() =>
  statsUnit.value === "USDT" ? t("analytics.equityCurve") : t("analytics.furCurve"),
);

const equityOptions = computed(() => ({
  chart: {
    toolbar: { show: false },
    zoom: { enabled: false },
    sparkline: { enabled: true },
  },
  plotOptions: {
    bar: {
      columnWidth: "55%",
      borderRadius: 6,
    },
  },
  colors: ["#02C076"],
  grid: { show: false },
  xaxis: {
    categories: historyDates.value,
    labels: { show: false },
    axisBorder: { show: false },
    axisTicks: { show: false },
  },
  yaxis: { labels: { show: false } },
  tooltip: { theme: "dark" },
  dataLabels: { enabled: false },
}));

const allocationSeries = computed(() => {
  if (statsUnit.value === "USDT") return [inWork.value, furUsdtValue.value];
  return [furEarned.value, furFrozen.value];
});

const allocationOptions = computed(() => ({
  labels:
    statsUnit.value === "USDT"
      ? [t("analytics.inWork"), t("analytics.furTokens")]
      : [t("analytics.furEarned"), t("analytics.furFrozen")],
  chart: { toolbar: { show: false } },
  legend: { show: false },
  dataLabels: { enabled: false },
  colors: ["#02c076", "#b77bff"],
  stroke: { colors: ["#0b0a10"] },
}));

const allocationLegend = computed(() => {
  if (statsUnit.value === "USDT") {
    return [
      { label: t("analytics.inWork"), value: inWork.value, unit: "USDT", color: "var(--accent)" },
      { label: t("analytics.furTokens"), value: furUsdtValue.value, unit: "USDT", color: "#b77bff" },
    ];
  }
  return [
    { label: t("analytics.furEarned"), value: furEarned.value, unit: "FUR", color: "var(--accent)" },
    { label: t("analytics.furFrozen"), value: furFrozen.value, unit: "FUR", color: "#b77bff" },
  ];
});

const goDeposit = () => {
  navigateTo("/balance");
};

const normalizeHistory = (items: Array<{ date: string; totalBalance: number }>) => {
  if (equityGranularity.value === "day") {
    return {
      labels: items.map((item) => new Date(item.date).toLocaleDateString()),
      values: items.map((item) => Number(item.totalBalance)),
    };
  }

  const monthMap = new Map<string, number>();
  for (const item of items) {
    const date = new Date(item.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, Number(item.totalBalance));
  }

  const labels = Array.from(monthMap.keys()).map((key) => {
    const [year, month] = key.split("-");
    return `${month}/${year}`;
  });
  const values = Array.from(monthMap.values());
  return { labels, values };
};

const allocationTitle = computed(() =>
  statsUnit.value === "USDT" ? t("analytics.assetAllocation") : t("analytics.furAllocation"),
);

</script>

<style scoped>
.analytics-stack {
  display: grid;
  gap: 18px;
}
.chart-card {
  padding: 16px;
  background: radial-gradient(120% 120% at 0% 0%, rgba(54, 48, 80, 0.35), transparent 60%),
    #15131e;
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
}
.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.stats-toggle {
  display: inline-flex;
  gap: 6px;
  padding: 4px;
  background: #17151f;
  border-radius: 999px;
  border: 1px solid #232031;
}
.stats-toggle .pill {
  padding: 6px 16px;
  border-radius: 999px;
  background: transparent;
  font-weight: 700;
  color: #bdb8cc;
  border: 1px solid transparent;
}
.stats-toggle .pill--active {
  background: rgba(2, 192, 118, 0.18);
  color: var(--accent);
  border-color: rgba(2, 192, 118, 0.35);
}
.allocation-grid {
  display: grid;
  gap: 16px;
  margin-top: 12px;
}
.allocation-legend {
  display: grid;
  gap: 8px;
}
.legend-item {
  display: grid;
  grid-template-columns: 12px 1fr auto;
  gap: 8px;
  align-items: center;
  font-size: 13px;
}
.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.legend-value {
  font-weight: 600;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}
.stat-card {
  display: grid;
  gap: 6px;
  padding: 16px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(36, 32, 49, 0.85), rgba(20, 18, 28, 0.85));
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}
.stat-top {
  color: #9f99b3;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.stat-value {
  font-size: 20px;
  font-weight: 800;
  color: var(--accent);
}
.stat-caption {
  color: #bdb8cc;
  font-size: 13px;
}
.empty-banner {
  display: grid;
  gap: 8px;
  padding: 18px;
}
.empty-title {
  font-weight: 700;
  font-size: 16px;
}
</style>
