<template>
  <section class="page page--staked">
    <div class="card hero-card">
      <div class="card-row">
        <div style="display: flex; gap: 10px; align-items: center">
          <div class="avatar">{{ initials }}</div>
          <div>
            <div class="greeting">{{ t("home.greeting") }} {{ displayName }}</div>
          </div>
        </div>
        <button class="icon-button" :aria-label="t('home.scan')">⌁</button>
      </div>
      <div class="balance-block">
        <div class="balance-label">{{ t("home.totalBalance") }}</div>
        <div class="balance-row">
          <div class="balance-value">{{ displayBalance }} {{ balanceUnit }}</div>
          <div class="balance-toggle">
            <button
              class="pill"
              :class="{ 'pill--active': balanceUnit === 'USDT' }"
              @click="balanceUnit = 'USDT'"
            >
              USDT
            </button>
            <button
              class="pill"
              :class="{ 'pill--active': balanceUnit === 'FUR' }"
              @click="balanceUnit = 'FUR'"
            >
              FUR
            </button>
          </div>
        </div>
        <div v-if="stakeActive" class="payout-progress payout-progress--balance">
          <div class="payout-progress-row">
            <span class="muted">{{ t("home.nextPayout") }}</span>
            <span class="payout-progress-value">{{ payoutCountdownLabel }}</span>
          </div>
          <div class="progress-track progress-track--compact">
            <div class="progress-fill" :style="{ width: payoutProgressLabel }"></div>
          </div>
        </div>
        <div class="balance-meta">
          <div class="balance-meta-row">
            <span class="muted">{{ t("home.lockedBalance") }}</span>
            <span class="balance-meta-value">{{ formatAmountOrPlaceholder(lockedBalance, hasFunds) }} USDT</span>
          </div>
          <div class="balance-meta-row">
            <span class="muted">{{ t("home.availableToWithdraw") }}</span>
            <span class="balance-meta-value">
              {{ formatAmountOrPlaceholder(availableProfit, hasFunds) }} USDT
            </span>
          </div>
        </div>
      </div>
      <div v-if="!hasFunds" class="empty-invest">
        <div class="empty-title">{{ t("common.noFundsTitle") }}</div>
        <div class="muted">{{ t("common.noFundsText") }}</div>
        <button class="button button--primary button-full" @click="goDeposit">
          {{ t("common.startInvesting") }}
        </button>
      </div>
    <div class="actions actions--minimal">
      <button class="action-btn action-btn--pill action-btn--ghost" @click="goSent">
        {{ t("common.send") }}
      </button>
      <button class="action-btn action-btn--pill action-btn--accent" @click="goDeposit">
        {{ t("common.deposit") }}
      </button>
    </div>
    </div>

    <div v-if="hasDeposit && !stakeActive" class="card activate-card">
      <div>
        <div class="activate-title">{{ t("home.activateInvestment") }}</div>
        <div class="muted">{{ t("home.activateInvestmentText") }}</div>
      </div>
      <button class="button button--primary" @click="openStakeTab">
        {{ t("home.stakedTab") }}
      </button>
    </div>

    <div class="card activity-card">
      <div class="muted">{{ t("home.communityActivity") }}</div>
      <div class="activity-row">
        <div class="activity-dot"></div>
        <div class="activity-text">{{ activityMessage }}</div>
      </div>
    </div>

    <div class="tabs">
      <button class="tab" :class="{ 'tab--active': activeTab === 'tokens' }" @click="activeTab = 'tokens'">
        {{ t("common.tokens") }}
      </button>
      <button
        class="tab"
        :class="{ 'tab--active': activeTab === 'transactions' }"
        @click="activeTab = 'transactions'"
      >
        {{ t("common.transactions") }}
      </button>
      <button class="tab" :class="{ 'tab--active': activeTab === 'staked' }" @click="activeTab = 'staked'">
        {{ t("home.stakedTab") }}
      </button>
    </div>

    <div v-if="loading" class="loading-wrap">
      <LoadingSpinner />
    </div>
    <div v-else>
      <div v-if="error && error !== openInTelegramMessage" class="card">{{ error }}</div>
      <transition name="fade-slide" mode="out-in">
        <div class="list" v-if="activeTab === 'tokens'" key="tokens">
          <div class="list-item">
            <div class="list-left">
              <div class="token-avatar fur">F</div>
              <div>
                <div class="list-title">{{ t("home.furToken") }}</div>
                <div class="list-sub">{{ t("home.mainToken") }}</div>
              </div>
            </div>
            <div class="list-right">
              <div class="list-amount">
                {{ formatAmountOrPlaceholder(dashboard?.furBalance || 0, hasFunds) }}
              </div>
              <div class="list-sub">FUR</div>
            </div>
          </div>
          <div class="list-item">
            <div class="list-left">
              <div class="token-avatar usdt">U</div>
              <div>
                <div class="list-title">USDT</div>
                <div class="list-sub">{{ t("common.balance") }}</div>
              </div>
            </div>
            <div class="list-right">
              <div class="list-amount">
                {{ formatAmountOrPlaceholder(dashboard?.available || 0, hasFunds) }}
              </div>
              <div class="list-sub">USDT</div>
            </div>
          </div>
        </div>

        <div class="list" v-else-if="activeTab === 'transactions'" key="transactions">
          <div v-for="tx in recentTransactions" :key="tx.id" class="list-item tx-row">
            <div class="list-left">
              <div class="token-avatar" :class="txTokenClass(tx)">{{ txTokenLabel(tx) }}</div>
              <div>
                <div class="list-title">{{ txTitle(tx) }}</div>
                <div class="list-sub">{{ new Date(tx.createdAt).toLocaleString() }}</div>
              </div>
            </div>
            <div class="list-right">
              <div class="list-amount" :class="{ positive: txSign(tx) === '+' }">
                {{ formatSignedAmount(tx) }}
              </div>
              <div class="list-sub">{{ displayCurrency(tx.currency) }}</div>
            </div>
          </div>
          <div v-if="!recentTransactions.length" class="card empty-banner">
            <div class="empty-title">{{ t("history.emptyTitle") }}</div>
            <div class="muted">{{ t("history.emptyText") }}</div>
          </div>
        </div>
        <div class="list" v-else key="staked">
          <div v-if="!hasDeposit" class="card empty-banner">
            <div class="empty-title">{{ t("home.noDepositTitle") }}</div>
            <div class="muted">{{ t("home.noDepositText") }}</div>
            <button class="button button--primary button-full" @click="goDeposit">
              {{ t("common.startInvesting") }}
            </button>
          </div>
          <div v-else class="card stake-card">
            <div class="muted stake-label">
              <span class="stake-icon">🪙</span>
              {{ t("home.stakeBalance") }}
            </div>
            <div class="stake-balance">
              {{ formatAmountOrPlaceholder(stakeAmount, hasDeposit) }} USDT
            </div>
            <div class="stake-input-row">
              <input
                v-model="stakeInput"
                class="input stake-input"
                inputmode="decimal"
                :placeholder="t('home.stakeAmountPlaceholder')"
              />
              <button class="pill stake-max" @click="setMaxStake">{{ t("common.max") }}</button>
            </div>
            <input
              v-model="stakeSlider"
              class="stake-range"
              type="range"
              min="0"
              :max="stakeAmount"
              :step="0.1"
              :style="{ background: rangeTrackStyle }"
            />
            <div class="muted stake-label" style="margin-top: 8px">
              <span class="stake-icon">📅</span>
              {{ t("home.stakeTerm") }}
            </div>
            <div class="pill-row pill-row--stake">
              <button
                v-for="duration in stakeDurations"
                :key="duration"
                class="pill pill--stake"
                :class="{ 'pill--active': selectedStake === duration }"
                :disabled="stakeActive"
                @click="selectStake(duration)"
              >
                <div>{{ duration }} {{ t("common.day") }}</div>
                <div class="pill-sub">({{ dailyPercentLabel.toLowerCase() }})</div>
              </button>
            </div>
            <div class="stake-summary stake-summary--glass" :class="{ 'stake-summary--inactive': stakeSummaryInactive }">
              <div class="stake-summary-caption">
                {{ t("home.stakeEstimateLabel", { tier: profile?.effectiveTier ?? profile?.currentTier ?? 0 }) }}
              </div>
              <div class="stake-summary-title">{{ t("home.investmentSummary") }}</div>
              <div class="stake-summary-row">
                <span class="muted">{{ t("home.dailyProfit") }}</span>
                <span class="stake-green">{{ dailyIncomeDisplay }}</span>
              </div>
              <div class="stake-summary-row">
                <span class="muted">{{ t("home.totalProfit") }}</span>
                <span class="stake-green">+{{ netProfitDisplay }}</span>
              </div>
              <div class="stake-summary-row">
                <span class="muted">{{ t("home.totalPayout") }}</span>
                <span>{{ totalReturnDisplay }}</span>
              </div>
              <div class="stake-summary-note">{{ t("home.compoundNote") }}</div>
            </div>
            <button
              class="button button--primary button-full"
              :class="{ 'button--pulse': stakeInputNumber > 0 && !stakeActive }"
              :disabled="stakeActive || !stakeInputNumber || stakeInputNumber > stakeAmount"
              @click="activateStake"
            >
              {{ stakeButtonLabel }}
            </button>
            <div v-if="!stakeActive" class="stake-hint">
              {{ t("home.noActiveStakes") }}
            </div>
          </div>
          <div v-if="stakeActive" class="card stake-card stake-card--active stake-card--glass">
            <div class="stake-row">
              <div class="muted">{{ t("home.stakeActiveTitle") }}</div>
              <div class="stake-pill">{{ selectedStake }} {{ t("common.day") }}</div>
            </div>
            <div class="stake-toggle">
              <span class="muted">{{ t("home.autoReinvest") }}</span>
              <label class="switch">
                <input type="checkbox" v-model="autoReinvestEnabled" @change="saveAutoReinvest" />
                <span class="switch-slider"></span>
              </label>
            </div>
            <div class="stake-meta">
              <div class="stake-meta-label">
                <svg class="stake-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 17l6-6 4 4 7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M14 8h6v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span class="muted">{{ t("home.profitToday") }}</span>
              </div>
              <div class="stake-countdown stake-profit">{{ profitTodayDisplay }}</div>
            </div>
            <div class="stake-meta">
              <div class="stake-meta-label">
                <svg class="stake-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/>
                  <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="2"/>
                  <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="2"/>
                  <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="2"/>
                </svg>
                <span class="muted">{{ t("home.stakeEndsIn") }}</span>
              </div>
              <div class="stake-countdown">{{ stakeEndsIn }}</div>
            </div>
            <button class="button button--ghost button-full unstake-btn" @click="emergencyUnstake">
              {{ t("home.emergencyUnstake") }}
            </button>
            <div class="muted unstake-note">{{ t("home.emergencyNote") }}</div>
          </div>
        </div>
      </transition>
    </div>
    <div v-if="emergencyModalOpen" class="modal-backdrop" @click.self="closeEmergencyModal(false)">
      <div class="modal-card">
        <button class="modal-close" @click="closeEmergencyModal(false)">✕</button>
        <div class="modal-title">{{ t("home.emergencyUnstake") }}</div>
        <div class="modal-text">{{ t("home.emergencyConfirmText") }}</div>
        <div class="modal-metrics">
          <div class="modal-metric">
            <div class="modal-label">{{ t("home.emergencyLose") }}</div>
            <div class="modal-value modal-value--danger">
              -{{ formatAmount(emergencyPenalty, 2) }} USDT
            </div>
          </div>
          <div class="modal-metric">
            <div class="modal-label">{{ t("home.emergencyReceive") }}</div>
            <div class="modal-value">
              +{{ formatAmount(emergencyPayout, 2) }} USDT
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="button button--ghost" @click="closeEmergencyModal(false)">
            {{ t("common.cancel") }}
          </button>
          <button class="button button--primary" @click="closeEmergencyModal(true)">
            {{ t("common.confirm") }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const { apiFetch } = useApi();
const { token, loadToken, clearToken, ensureToken } = useAuth();
const { t } = useI18n();
const { formatAmount, formatAmountOrPlaceholder, calculateCompound } = useFormatting();
const { displayCurrency, txTitle, txSign, formatSignedAmount, txTokenClass, txTokenLabel } =
  useTransactionUtils();
const { showToast } = useToast();

const { impact } = useHaptics();
const dashboard = ref<any>(null);
const profile = ref<any>(null);
const deposits = ref<any[]>([]);
const { displayName, initials } = useUserDisplay(profile, { fallbackName: "Account" });
const loading = ref(true);
const error = ref<string | null>(null);
const activeTab = ref<"tokens" | "transactions" | "staked">("tokens");
const animatedBalance = ref("0");
const activityMessage = ref("");
const balanceUnit = ref<"USDT" | "FUR">("USDT");
const furRate = 0.45;
const displayBalance = computed(() =>
  formatAmountOrPlaceholder(Number(animatedBalance.value), hasFunds.value, 1, t("common.placeholder")),
);
const balanceTarget = computed(() => {
  const base = Number(dashboard.value?.balance || 0);
  return balanceUnit.value === "USDT" ? base : base / furRate;
});

const activityFeed = computed(() => [
  t("home.activity1"),
  t("home.activity2"),
  t("home.activity3"),
  t("home.activity4"),
  t("home.activity5"),
  t("home.activity6"),
  t("home.activity7"),
  t("home.activity8"),
  t("home.activity9"),
  t("home.activity10"),
]);

const recentTransactions = computed(() => dashboard.value?.recentTransactions || []);
const hasFunds = computed(() => {
  const total =
    Number(dashboard.value?.balance || 0) +
    Number(dashboard.value?.inTariffs || 0) +
    Number(dashboard.value?.furBalance || 0);
  return total > 0;
});
const hasDeposit = computed(() => deposits.value.length > 0);
const latestDeposit = computed(() => deposits.value[0] || null);
const stakeAmount = computed(() => Number(dashboard.value?.inTariffs || 0));
const lockedBalance = computed(() => Number(dashboard.value?.inTariffs || 0));
const availableProfit = computed(() => Number(dashboard.value?.profitAvailable || 0));
const stakeInput = ref("");
const stakeSlider = ref(0);
const stakeInputNumber = computed(() => Number(stakeInput.value.replace(",", ".")));
const autoReinvestEnabled = ref(true);
const emergencyModalOpen = ref(false);
const emergencyPenalty = ref(0);
const emergencyPayout = ref(0);
let emergencyResolve: ((value: boolean) => void) | null = null;
const profitTodayAnimated = ref("0.00");
const profitTodayDisplay = computed(() =>
  stakeActive.value ? `${profitTodayAnimated.value} USDT` : "0.00 USDT",
);
const stakeSummaryInactive = computed(() => !stakeInputNumber.value);
const dailyPercent = computed(() => Number(dashboard.value?.dailyPercent || 0));
const dailyPercentLabel = computed(() => `${dailyPercent.value}% ${t("common.daily")}`);
const selectedStakeDays = computed(() => Number(selectedStake.value || 0));
const totalReturn = computed(() => {
  if (!stakeInputNumber.value || !selectedStakeDays.value) return 0;
  return calculateCompound(stakeInputNumber.value, dailyPercent.value, selectedStakeDays.value);
});
const netProfit = computed(() => Math.max(0, totalReturn.value - stakeInputNumber.value));
const dailyIncome = computed(() => (stakeInputNumber.value || 0) * (dailyPercent.value / 100));
const totalReturnLabel = computed(() => `${totalReturn.value.toFixed(2)} USDT`);
const netProfitLabel = computed(() => `${netProfit.value.toFixed(2)} USDT`);
const dailyIncomeLabel = computed(() => `${dailyIncome.value.toFixed(2)} USDT`);
const stakeButtonLabel = computed(() => {
  if (!stakeInputNumber.value) return t("home.stakeEnterAmount");
  if (stakeInputNumber.value > stakeAmount.value) return t("home.stakeInsufficient");
  return t("home.stakeAmountCta", { amount: stakeInputNumber.value.toFixed(2) });
});
const summaryAnimating = ref(false);
const animatedTotalReturn = ref("0.00");
const animatedNetProfit = ref("0.00");
const animatedDailyIncome = ref("0.00");
const totalReturnDisplay = computed(() =>
  summaryAnimating.value ? `${animatedTotalReturn.value} USDT` : totalReturnLabel.value,
);
const netProfitDisplay = computed(() =>
  summaryAnimating.value ? `${animatedNetProfit.value} USDT` : netProfitLabel.value,
);
const dailyIncomeDisplay = computed(() =>
  summaryAnimating.value ? `${animatedDailyIncome.value} USDT` : dailyIncomeLabel.value,
);
const rangeTrackStyle = computed(() => {
  const max = stakeAmount.value || 1;
  const percent = Math.min(100, Math.max(0, (stakeSlider.value / max) * 100));
  return `linear-gradient(90deg, var(--accent) 0%, #8cc7ff ${percent}%, #1f1c28 ${percent}%)`;
});

const animateNumber = (target: number, output: Ref<string>, duration = 900, decimals = 1) => {
  const start = performance.now();
  const from = 0;
  output.value = (0).toFixed(decimals);
  const diff = target - from;
  const step = (now: number) => {
    const progress = Math.min(1, (now - start) / duration);
    const value = from + diff * progress;
    output.value = value.toFixed(decimals);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};

const stakeDurations = [15, 30, 60];
const selectedStake = ref(30);
const stakeActive = computed(
  () => Boolean(latestDeposit.value?.stakeDurationDays && latestDeposit.value?.stakeActivatedAt),
);

const nowTick = ref(Date.now());
let timerInterval: ReturnType<typeof setInterval> | null = null;
let activityInterval: ReturnType<typeof setInterval> | null = null;

const startClock = () => {
  nowTick.value = Date.now();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    nowTick.value = Date.now();
  }, 1000);
};

const stopClock = () => {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
};

const startActivity = () => {
  activityMessage.value = activityFeed.value[0];
  let idx = 1;
  if (activityInterval) clearInterval(activityInterval);
  activityInterval = setInterval(() => {
    activityMessage.value = activityFeed.value[idx % activityFeed.value.length];
    idx += 1;
  }, 2500);
};

const goDeposit = () => {
  impact("light");
  navigateTo("/balance");
};

const goSent = () => {
  impact("light");
  navigateTo("/sent");
};

const openStakeTab = () => {
  impact("light");
  activeTab.value = "staked";
};

const msInDay = 24 * 60 * 60 * 1000;
const depositStartAt = computed(() => {
  const raw = latestDeposit.value?.startDate || latestDeposit.value?.createdAt;
  return raw ? new Date(raw).getTime() : null;
});

const stakeActivatedAt = computed(() => {
  const raw = latestDeposit.value?.stakeActivatedAt;
  return raw ? new Date(raw).getTime() : null;
});

const formatCountdownWithDays = (ms: number | null) => {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return t("common.placeholder");
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const h = String(Math.floor((total % 86400) / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${days}d ${h}:${m}:${s}`;
};

const payoutProgress = computed(() => {
  if (!stakeActive.value) return 0;
  const now = new Date(nowTick.value);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const elapsed = Math.max(0, nowTick.value - dayStart);
  return Math.min(1, elapsed / msInDay);
});

const payoutProgressLabel = computed(() => `${Math.round(payoutProgress.value * 100)}%`);
const payoutCountdownLabel = computed(() => {
  if (!stakeActive.value) return t("common.placeholder");
  const now = new Date(nowTick.value);
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return formatCountdownWithDays(midnight.getTime() - nowTick.value).replace(/^0d\s/, "");
});

const stakeEndAt = computed(() => {
  if (!stakeActive.value || !stakeActivatedAt.value) return null;
  const duration = Number(latestDeposit.value?.stakeDurationDays || 0);
  return stakeActivatedAt.value + duration * msInDay;
});

const stakeEndsIn = computed(() => formatCountdownWithDays(stakeEndAt.value ? stakeEndAt.value - nowTick.value : null));
const syncStakeState = () => {
  const duration = Number(latestDeposit.value?.stakeDurationDays || 0);
  if (duration) {
    selectedStake.value = duration;
  }
  if (!stakeInput.value) {
    stakeSlider.value = stakeAmount.value;
  }
  autoReinvestEnabled.value = latestDeposit.value?.autoReinvest ?? true;
};

const activateStake = async () => {
  if (!latestDeposit.value) return;
  if (!stakeInputNumber.value || stakeInputNumber.value > stakeAmount.value) {
    showToast(t("home.stakeAmountInvalid"));
    return;
  }
  try {
    await apiFetch(`/deposits/${latestDeposit.value.id}/stake`, {
      method: "POST",
      body: { durationDays: selectedStake.value, amount: stakeInputNumber.value },
    });
    deposits.value = await apiFetch("/deposits", { noCache: true });
    dashboard.value = await apiFetch("/dashboard", { noCache: true });
    syncStakeState();
    showToast(t("home.stakeActiveTitle"));
  } catch (err: any) {
    showToast(err?.message || t("home.failedDashboard"));
  }
};

const saveAutoReinvest = async () => {
  if (!latestDeposit.value) return;
  try {
    await apiFetch(`/deposits/${latestDeposit.value.id}/auto-reinvest`, {
      method: "POST",
      body: { autoReinvest: autoReinvestEnabled.value },
    });
    impact("light");
    showToast(t("home.settingsUpdated"));
  } catch (err: any) {
    autoReinvestEnabled.value = !autoReinvestEnabled.value;
    showToast(err?.message || t("home.autoReinvestFailed"));
  }
};

const openEmergencyModal = (penalty: number, payout: number) => {
  emergencyPenalty.value = penalty;
  emergencyPayout.value = payout;
  emergencyModalOpen.value = true;
  return new Promise<boolean>((resolve) => {
    emergencyResolve = resolve;
  });
};

const closeEmergencyModal = (confirmed: boolean) => {
  emergencyModalOpen.value = false;
  if (emergencyResolve) {
    emergencyResolve(confirmed);
    emergencyResolve = null;
  }
};

const emergencyUnstake = async () => {
  if (!latestDeposit.value) return;
  const amount = Number(latestDeposit.value?.amount || 0);
  const penalty = amount * 0.075;
  const payout = Math.max(0, amount - penalty);
  const confirmed = await openEmergencyModal(penalty, payout);
  if (!confirmed) return;
  try {
    impact("heavy");
    await apiFetch(`/deposits/${latestDeposit.value.id}/unstake`, { method: "POST" });
    showToast(t("home.emergencySuccess"));
    impact("light");
    [dashboard.value, profile.value, deposits.value] = await Promise.all([
      apiFetch("/dashboard", { noCache: true }),
      apiFetch("/users/me", { noCache: true }),
      apiFetch("/deposits", { noCache: true }),
    ]);
  } catch (err: any) {
    showToast(err?.message || t("home.emergencyFailed"));
  }
};

const setMaxStake = () => {
  impact("light");
  stakeInput.value = stakeAmount.value ? stakeAmount.value.toFixed(1) : "0";
  stakeSlider.value = stakeAmount.value;
  if (stakeAmount.value > 0) {
    summaryAnimating.value = true;
    animateNumber(totalReturn.value, animatedTotalReturn, 700, 2);
    animateNumber(netProfit.value, animatedNetProfit, 700, 2);
    animateNumber(dailyIncome.value, animatedDailyIncome, 700, 2);
    setTimeout(() => {
      summaryAnimating.value = false;
    }, 720);
  }
};

const selectStake = (duration: number) => {
  if (stakeActive.value) return;
  impact("light");
  selectedStake.value = duration;
};

watch(
  () => stakeSlider.value,
  (value) => {
    if (stakeActive.value) return;
    stakeInput.value = Number(value).toFixed(1);
  },
);

watch(
  () => stakeInput.value,
  (value) => {
    if (stakeActive.value) return;
    const numeric = Number(String(value).replace(",", "."));
    if (Number.isFinite(numeric)) {
      stakeSlider.value = Math.min(stakeAmount.value, Math.max(0, numeric));
    }
  },
);

const openInTelegramMessage = computed(() => t("home.openInTelegram"));

onMounted(async () => {
  loadToken();
  try {
    await ensureToken();
    if (!token.value) return;
    [dashboard.value, profile.value, deposits.value] = await Promise.all([
      apiFetch("/dashboard"),
      apiFetch("/users/me"),
      apiFetch("/deposits"),
    ]);
    if (hasFunds.value) {
      animateNumber(balanceTarget.value, animatedBalance);
    }
    syncStakeState();
    if (stakeActive.value) startClock();
    startActivity();
  } catch (err: any) {
    if (err?.status === 401) {
      clearToken();
      try {
        await ensureToken();
        if (!token.value) return;
        [dashboard.value, profile.value, deposits.value] = await Promise.all([
          apiFetch("/dashboard"),
          apiFetch("/users/me"),
          apiFetch("/deposits"),
        ]);
        if (hasFunds.value) {
          animateNumber(balanceTarget.value, animatedBalance);
        }
        syncStakeState();
        if (stakeActive.value) startClock();
        startActivity();
      } catch (retryErr: any) {
        error.value = retryErr?.message || t("home.authFailed");
      }
    } else {
      error.value = err?.message || t("home.failedDashboard");
    }
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
  if (activityInterval) clearInterval(activityInterval);
});

watch(
  () => [balanceUnit.value, dashboard.value?.balance, hasFunds.value],
  () => {
    if (!hasFunds.value) {
      animatedBalance.value = "0";
      return;
    }
    animateNumber(balanceTarget.value, animatedBalance);
  },
);

watch(
  () => dashboard.value?.incomeToday,
  (value) => {
    if (!stakeActive.value) {
      profitTodayAnimated.value = "0.00";
      return;
    }
    const numeric = Number(value || 0);
    animateNumber(numeric, profitTodayAnimated, 700, 2);
  },
  { immediate: true },
);
watch(
  () => stakeActive.value,
  (active) => {
    if (active) {
      startClock();
    } else {
      stopClock();
    }
  },
);

 
</script>

<style scoped>
.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #2b2635;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #c7c3d6;
}
.greeting {
  font-weight: 700;
  font-size: 16px;
}
.hero-card {
  background: radial-gradient(120% 140% at 100% 0%, rgba(2, 192, 118, 0.12), transparent 60%),
    radial-gradient(120% 140% at 0% 100%, rgba(183, 123, 255, 0.14), transparent 60%),
    #17151f;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
}
.balance-block {
  margin: 16px 0 10px;
  text-align: left;
}
.balance-label {
  color: #b7b3c7;
  font-size: 13px;
  letter-spacing: 0.2px;
}
.balance-value {
  font-size: 30px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  min-width: 140px;
}
.balance-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 6px;
}
.balance-toggle {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.balance-toggle .pill {
  padding: 3px 8px;
  font-size: 10px;
}
.payout-progress {
  margin-top: 10px;
  display: grid;
  gap: 6px;
}
.payout-progress-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
}
.progress-row-inline {
  display: flex;
  align-items: center;
  gap: 10px;
}
.progress-inline-label {
  font-size: 11px;
  color: #9a96aa;
  min-width: 64px;
  text-align: right;
}
.payout-progress-value {
  font-weight: 800;
  font-size: 14px;
  color: var(--accent);
}
.progress-track {
  height: 8px;
  border-radius: 999px;
  background: #1f1c28;
  border: 1px solid rgba(255, 255, 255, 0.06);
  overflow: hidden;
}
.progress-track--compact {
  height: 6px;
}
.progress-fill {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, rgba(2, 192, 118, 0.9), rgba(183, 123, 255, 0.9));
  border-radius: inherit;
  transition: width 0.4s ease;
}
.progress-label {
  margin-top: 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
}
.balance-meta {
  margin-top: 10px;
  display: grid;
  gap: 6px;
}
.payout-progress--balance {
  margin: 8px 0 6px;
}
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(12, 10, 18, 0.72);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 40;
}
.modal-card {
  width: min(420px, 100%);
  background: #17151f;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
  padding: 22px 20px 18px;
  position: relative;
}
.modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: #d8d6e3;
  font-size: 16px;
  display: grid;
  place-items: center;
}
.modal-title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 6px;
}
.modal-text {
  color: #b7b3c7;
  font-size: 13px;
  line-height: 1.5;
}
.modal-metrics {
  margin-top: 16px;
  padding: 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  display: grid;
  gap: 10px;
}
.modal-metric {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.modal-label {
  color: #9f9ab3;
  font-size: 12px;
}
.modal-value {
  font-weight: 700;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}
.modal-value--danger {
  color: #ff4b61;
}
.modal-actions {
  margin-top: 18px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.balance-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
}
.balance-meta-value {
  font-weight: 600;
  color: #d8d6e3;
}
.empty-invest {
  margin-top: 12px;
  padding: 14px;
  border-radius: 18px;
  background: #1a1724;
  display: grid;
  gap: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.08);
}
.activate-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.activate-title {
  font-weight: 700;
}
.stake-card {
  display: grid;
  gap: 10px;
}
.stake-input-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
}
.stake-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.stake-icon {
  font-size: 14px;
  opacity: 0.8;
}
.stake-input {
  font-size: 14px;
  padding: 10px 12px;
}
.stake-max {
  padding: 6px 14px;
  font-size: 12px;
}
.stake-range {
  width: 100%;
  height: 6px;
  appearance: none;
  background: #1f1c28;
  border-radius: 999px;
  outline: none;
  transition: background 0.2s ease;
}
.stake-range::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid #0b0a10;
  box-shadow: 0 4px 10px rgba(2, 192, 118, 0.3);
}
.stake-range::-webkit-slider-thumb:active {
  transform: scale(1.06);
}
.stake-range::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid #0b0a10;
}
.stake-summary {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid #262332;
  transition: opacity 0.2s ease;
}
.stake-summary--glass,
.stake-card--glass {
  background: rgba(24, 22, 32, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(20px);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35), inset 0 0 0 1px rgba(2, 192, 118, 0.08);
}
.stake-summary--inactive {
  opacity: 0.55;
}
.stake-summary-caption {
  font-size: 11px;
  color: #8d8a9b;
}
.stake-summary-title {
  font-weight: 700;
  font-size: 12px;
  color: #cfeee6;
}
.stake-summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: rgba(228, 226, 238, 0.6);
}
.stake-summary-note {
  font-size: 11px;
  color: #8d8a9b;
}
.stake-green {
  color: #38f7a4;
  text-shadow: 0 0 6px rgba(56, 247, 164, 0.35);
}
.stake-hint {
  font-size: 11px;
  color: #8d8a9b;
  text-align: center;
  margin-top: -4px;
}
.pill-sub {
  font-size: 10px;
  color: #9a96aa;
  margin-top: 4px;
}
.pill-row--stake {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.pill--stake {
  padding: 10px 8px;
  line-height: 1.1;
  min-height: 54px;
  display: grid;
  place-items: center;
  text-align: center;
}
.button--pulse {
  animation: stakePulse 1.6s ease-in-out infinite;
}
@keyframes stakePulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(2, 192, 118, 0.25);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(2, 192, 118, 0);
  }
}
.stake-card--active {
  background: linear-gradient(160deg, rgba(2, 192, 118, 0.12), rgba(23, 21, 31, 0.9));
}
.stake-balance {
  font-size: 24px;
  font-weight: 900;
  color: var(--accent);
  text-shadow: 0 0 10px rgba(2, 192, 118, 0.35);
}
.stake-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.stake-pill {
  padding: 6px 14px;
  border-radius: 999px;
  background: #2a2733;
  font-size: 12px;
  font-weight: 700;
  color: #f3f3f6;
  animation: badgePulse 2s ease-in-out infinite;
}
.stake-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.stake-meta-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.stake-icon-svg {
  width: 16px;
  height: 16px;
  color: #9bd7ff;
}
.stake-countdown {
  font-weight: 800;
  color: #f3f3f6;
  display: grid;
  gap: 4px;
  text-align: right;
}
.stake-countdown--inline {
  text-align: right;
}
.stake-profit {
  color: #02c076;
  text-shadow: 0 0 10px rgba(2, 192, 118, 0.35);
}
.progress-track {
  background: #1f1c28;
}
.progress-fill {
  position: relative;
  overflow: hidden;
}
.progress-fill::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.35) 50%, rgba(255, 255, 255, 0) 100%);
  transform: translateX(-120%);
  animation: shimmer 2s linear infinite;
}
.unstake-btn {
  border: 1px solid rgba(255, 122, 122, 0.6);
  color: #ff7a7a;
  background: transparent;
}
.unstake-note {
  font-size: 11px;
  font-style: italic;
  opacity: 0.6;
}
@keyframes shimmer {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(120%); }
}
@keyframes badgePulse {
  0% { box-shadow: 0 0 0 0 rgba(183, 123, 255, 0.25); }
  70% { box-shadow: 0 0 0 8px rgba(183, 123, 255, 0); }
  100% { box-shadow: 0 0 0 0 rgba(183, 123, 255, 0); }
}
.stake-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
}
.switch {
  position: relative;
  display: inline-flex;
  width: 44px;
  height: 24px;
}
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.switch-slider {
  position: absolute;
  inset: 0;
  background: #2a2733;
  border-radius: 999px;
  transition: background 0.2s ease;
}
.switch-slider::before {
  content: "";
  position: absolute;
  height: 18px;
  width: 18px;
  left: 3px;
  top: 3px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s ease;
}
.switch input:checked + .switch-slider {
  background: var(--accent);
}
.switch input:checked + .switch-slider::before {
  transform: translateX(20px);
}
.page--staked::before,
.page--staked::after {
  content: "";
  position: fixed;
  width: 420px;
  height: 420px;
  border-radius: 50%;
  filter: blur(120px);
  opacity: 0.18;
  z-index: 0;
  pointer-events: none;
}
.page--staked::before {
  top: -120px;
  right: -120px;
  background: radial-gradient(circle, rgba(146, 88, 255, 0.9), rgba(146, 88, 255, 0));
}
.page--staked::after {
  bottom: -160px;
  left: -120px;
  background: radial-gradient(circle, rgba(2, 192, 118, 0.9), rgba(2, 192, 118, 0));
}
.activity-card {
  margin-top: 11px;
  padding: 10px 12px;
}
.activity-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}
.activity-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 4px rgba(2, 192, 118, 0.45);
}
.activity-text {
  font-size: 11px;
  color: #d8d6e3;
}
.actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 12px;
}
.actions--minimal {
  grid-template-columns: repeat(2, 1fr);
}
.action-btn {
  border: none;
  background: #1a1724;
  border-radius: 20px;
  padding: 12px;
  color: #d4d1df;
  display: grid;
  gap: 6px;
  place-items: center;
  cursor: pointer;
}
.action-btn--pill {
  border-radius: 16px;
  padding: 10px 18px;
  background: #232031;
  color: #d8d6e3;
  font-weight: 600;
  text-transform: none;
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}
.action-btn--pill:hover {
  border-color: rgba(2, 192, 118, 0.45);
  box-shadow: 0 8px 18px rgba(2, 192, 118, 0.18);
}
.action-btn--pill:active {
  transform: translateY(0);
  box-shadow: none;
}
.action-btn--accent {
  background: linear-gradient(135deg, var(--accent) 0%, #8cc7ff 45%, #b77bff 100%);
  color: #0b0a10;
  border-color: transparent;
}
.action-btn--ghost {
  background: transparent;
  color: var(--accent);
  border-color: rgba(2, 192, 118, 0.35);
}
.action-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #242031;
  display: grid;
  place-items: center;
  color: var(--accent);
  font-weight: 700;
}
.action-label {
  font-size: 13px;
  color: var(--accent);
}
.tabs {
  display: flex;
  gap: 20px;
  align-items: center;
  padding: 4px 6px;
}
.tab {
  border: none;
  background: transparent;
  color: #8d8a9b;
  font-weight: 600;
  cursor: pointer;
  padding-bottom: 8px;
  transition: color 0.2s ease;
}
.tab:hover {
  color: #cfeee6;
}
.tab--active {
  color: #f3f3f6;
  border-bottom: 2px solid #f3f3f6;
}
.pill:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
.tx-row {
  background: linear-gradient(160deg, #1a1724 0%, #171520 100%);
}
.positive {
  color: var(--accent);
}
.button-full {
  width: 100%;
  margin-top: 16px;
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
