<template>
  <section class="page">
    <div class="section-title">{{ t("tariffs.title") }}</div>
    <div v-if="loading" class="loading-wrap">
      <LoadingSpinner />
    </div>
    <div v-else-if="error" class="card">{{ error }}</div>
    <div v-else>
      <div class="tariffs-top">
        <div class="section-title">{{ t("tariffs.currentTitle") }}</div>
        <div class="tier-scroll tier-scroll--current">
          <div v-if="currentTierInfo" class="tier-card tier-card--current">
            <div class="tier-top">
              <div class="tier-name">{{ tierName(currentTierInfo) }}</div>
              <div class="tier-badges">
                <span class="tier-badge tier-badge--active">
                  {{ t("tariffs.tierLabel") }} {{ currentTierInfo.tier }}
                </span>
                <span v-if="boostActive" class="tier-tag boost">⚡ {{ t("tariffs.boostTag") }}</span>
              </div>
            </div>
            <div v-if="boostActive" class="tier-boost-banner">
              <div class="tier-boost-line">
                <span class="tier-boost-label">{{ t("tariffs.boostActiveLabel") }}</span>
                <span class="tier-boost-value">Tier {{ userTier }}</span>
              </div>
              <div class="tier-boost-until">{{ t("tariffs.boostUntil", { time: boostUntilLabel }) }}</div>
              <div v-if="user?.currentTier !== userTier" class="tier-boost-base">
                {{ t("tariffs.boostBase", { tier: user?.currentTier ?? 0 }) }}
              </div>
            </div>
            <div class="tier-income">{{ tierIncome(currentTierInfo) }}</div>
            <div class="tier-req">
              {{ t("tariffs.compoundLabel", { percent: currentTierInfo.monthlyCompoundPercent || 0 }) }}
            </div>
          </div>
          <div v-else class="tier-card">
            <div class="tier-name">{{ t("tariffs.starter") }}</div>
            <div class="tier-income">{{ t("tariffs.dailyLabel", { percent: 1.5 }) }}</div>
          </div>
        </div>
        <div v-if="nextTierInfo" class="card tier-progress-panel">
          <div class="tier-progress-head">
            <div class="tier-progress-title">{{ t("tariffs.progressTo", { tier: nextTierInfo.tier }) }}</div>
            <div class="tier-progress-sub">{{ tierName(currentTierInfo) }}</div>
          </div>
          <div class="tier-progress-remaining">
            <span class="muted">{{ t("tariffs.toNextShort") }}</span>
            <span class="remaining-value">{{ remainingToNext }} USDT</span>
          </div>
          <div class="tier-progress-bars">
            <div class="tier-progress-item">
              <div class="tier-progress-meta">
                <span>
                  {{
                    t("tariffs.personal", {
                      current: formatAmount(user?.personalDepositSum || 0),
                      target: formatAmount(nextTierInfo.minPersonal || 0),
                    })
                  }}
                </span>
                <span class="tier-progress-percent">{{ personalProgressLabel }}</span>
              </div>
              <div class="tier-progress-bar">
                <div class="tier-progress-fill" :style="{ width: personalProgressLabel }"></div>
              </div>
            </div>
            <div class="tier-progress-item">
              <div class="tier-progress-meta">
                <span>
                  {{
                    t("tariffs.team", {
                      current: formatAmount(user?.teamTurnoverSum || 0),
                      target: formatAmount(nextTierInfo.minTeam || 0),
                    })
                  }}
                </span>
                <span class="tier-progress-percent">{{ teamProgressAnimatedLabel }}</span>
              </div>
              <div class="tier-progress-bar tier-progress-bar--team">
                <div
                  class="tier-progress-fill tier-progress-fill--violet tier-progress-fill--team"
                  :style="{ width: teamProgressAnimatedLabel }"
                ></div>
              </div>
            </div>
          </div>
          <div class="tier-progress-cheer">
            {{ cheerText }}
          </div>
        </div>
      </div>
      <button
        class="button button--primary button-full jump-tier"
        :class="{ 'jump-tier--disabled': !canJump, 'jump-tier--active': boostActive }"
        @click="jumpToTier"
      >
        {{ boostButtonLabel }}
      </button>
      <div class="tier-actions">
        <button class="button button--ghost button-full" @click="showCalculator = true">
          {{ t("tariffs.calculator") }}
        </button>
        <button class="button button--primary button-full see-all" @click="showAll = true">
          {{ t("tariffs.seeAll") }}
        </button>
      </div>

      <div class="section-title section-title--spaced">{{ t("tariffs.recentActivity") }}</div>
      <div class="list">
        <div v-for="item in recentAccruals" :key="item.id" class="list-item">
          <div class="list-left">
            <div class="token-avatar usdt">🪙</div>
            <div>
              <div class="list-title">{{ t("tariffs.accrualTitle") }}</div>
              <div class="list-sub">{{ formatRecentDate(item.createdAt) }}</div>
            </div>
          </div>
          <div class="list-right">
            <div class="list-amount list-amount--profit">
              <span class="list-amount-icon">+</span>{{ formatAmount(item.amount) }}
            </div>
            <div class="list-sub">USDT</div>
          </div>
        </div>
        <div v-if="!recentAccruals.length" class="card empty-banner">
          {{ t("tariffs.accrualEmpty") }}
        </div>
      </div>
      <button class="button button--ghost button-full invite-button" @click="copyInvite">
        {{ t("tariffs.inviteFriend") }}
      </button>
    </div>

    <div v-if="showAll" class="modal-backdrop" @click.self="showAll = false">
      <div class="modal">
        <div class="card-row">
          <div style="font-weight: 700">{{ t("tariffs.allTitle") }}</div>
          <button class="pill" @click="showAll = false">{{ t("common.close") }}</button>
        </div>
        <div class="modal-list">
          <div
            v-for="tier in tiers"
            :key="tier.tier"
            :class="[
              'tier-card',
              'tier-card--modal',
              tier.tier === userTier ? 'tier-card--current' : '',
            ]"
          >
          <div class="tier-top">
            <div class="tier-name">{{ tierName(tier) }}</div>
              <div class="tier-badges">
                <span class="tier-badge">{{ t("tariffs.tierLabel") }} {{ tier.tier }}</span>
                <span v-if="tier.tier === userTier" class="tier-tag current">
                  {{ t("tariffs.current") }}
                </span>
                <span v-else-if="tier.tier > userTier" class="tier-tag locked">
                  🔒 {{ t("tariffs.locked") }}
                </span>
                <span v-else class="tier-tag passed">
                  {{ t("tariffs.passed") }}
                </span>
              </div>
          </div>
          <div class="tier-income">{{ tierIncome(tier) }}</div>
          <div class="tier-req">
            {{ t("tariffs.compoundLabel", { percent: tier.monthlyCompoundPercent || 0 }) }}
          </div>
          <div class="tier-req-list tier-req-list--static">
              <div class="tier-req-item">
              <span class="tier-req-check">✓</span>
                <span>{{ t("tariffs.personalShort", { value: tierPersonalLabel(tier) }) }}</span>
              </div>
              <div class="tier-req-item">
              <span class="tier-req-check">✓</span>
                <span>{{ t("tariffs.teamShort", { value: tierTeamLabel(tier) }) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showCalculator" class="modal-backdrop" @click.self="showCalculator = false">
      <div class="modal">
        <div class="card-row">
          <div style="font-weight: 700">{{ t("tariffs.calculator") }}</div>
          <button class="pill" @click="showCalculator = false">{{ t("common.close") }}</button>
        </div>
        <div class="calc-grid">
          <div class="calc-tier">
            <div class="muted">{{ t("tariffs.simTier") }}</div>
            <div class="calc-tier-value">Tier {{ selectedTier }}</div>
          </div>
          <input
            v-model.number="selectedTier"
            class="calc-tier-range"
            type="range"
            min="0"
            max="10"
            step="1"
          />
          <div v-if="showUpgradeHint" class="calc-upgrade">
            <div class="muted">{{ t("tariffs.upgradeHint") }}</div>
            <button class="button button--ghost calc-upgrade-btn" @click="showAll = true">
              {{ t("tariffs.upgradeCta") }}
            </button>
          </div>
          <input
            v-model.number="calcAmount"
            class="input"
            type="number"
            :placeholder="t('tariffs.amountPlaceholder')"
          />
          <div class="calc-note">{{ t("tariffs.calcNote") }}</div>
          <div class="calc-row">
            <span>{{ t("tariffs.tierLabel") }}</span>
            <span>{{ calcTierName }}</span>
          </div>
          <div class="calc-row">
            <span>365 {{ t("common.day") }}</span>
            <span>{{ calc365 }} USDT</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const { apiFetch } = useApi();
const { token, loadToken } = useAuth();
const { t, language } = useI18n();
const { formatAmount, calculateCompound } = useFormatting();
const { impact } = useHaptics();
const { showToast } = useToast();

const tiers = ref<any[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const user = ref<any>(null);
const showAll = ref(false);
const showCalculator = ref(false);
const calcAmount = ref<number>(0);
const selectedTier = ref<number>(0);

onMounted(async () => {
  loadToken();
  if (!token.value) return;
  try {
  const [tiersResponse, userResponse, transactions, refStats] = await Promise.all([
      apiFetch("/tiers"),
      apiFetch("/users/me/recalculate-tier"),
      apiFetch("/transactions?page=1&pageSize=50"),
      apiFetch("/referrals/stats").catch(() => null),
    ]);
    tiers.value = tiersResponse?.tiers || [];
    user.value = userResponse;
    selectedTier.value = userTier.value;
    recentAccruals.value = (transactions || [])
      .filter((tx: any) => tx?.type === "ACCRUAL")
      .slice(0, 5);
    referralLink.value = refStats?.referralLink || "";
  } catch (err: any) {
    error.value = err?.message || t("tariffs.failed");
  } finally {
    loading.value = false;
  }
});

const userTier = computed(() => user.value?.effectiveTier ?? user.value?.currentTier ?? 0);
const currentTierInfo = computed(() => {
  const tier = userTier.value;
  return tiers.value.find((item: any) => item.tier === tier);
});

const nextTiers = computed(() => {
  const tier = userTier.value;
  return tiers.value.filter((item: any) => item.tier > tier);
});

const tierIncome = (tier: any) => {
  if (!tier) return "";
  return t("tariffs.dailyLabel", { percent: tier.dailyPercent });
};

const tierName = (tier: any) => {
  if (!tier) return t("tariffs.tierLabel");
  if (tier.tier === 0) return t("tariffs.starter");
  if (tier.tier === 10) return t("tariffs.vip");
  return `${t("tariffs.tierLabel")} ${tier.tier}`;
};

const tierPersonalLabel = (tier: any) => {
  if (tier.tier === 0) return t("tariffs.tier0Range");
  return `${tier.minPersonal}+`;
};

const tierTeamLabel = (tier: any) => {
  if (tier.tier === 0) return "—";
  return `${tier.minTeam}+`;
};

const remainingToNext = computed(() => {
  if (!nextTierInfo.value) return 0;
  const personal = Number(user.value?.personalDepositSum || 0);
  const team = Number(user.value?.teamTurnoverSum || 0);
  const personalTarget = Number(nextTierInfo.value.minPersonal || 0);
  const target = Number(nextTierInfo.value.minTeam || 0);
  const personalRemaining = Math.max(0, personalTarget - personal);
  const teamRemaining = Math.max(0, target - team);
  const remaining = Math.min(personalRemaining, teamRemaining);
  return Math.round(remaining);
});

const calcTierInfo = computed(() => tiers.value.find((t: any) => t.tier === selectedTier.value));
const calcTierName = computed(() => tierName(calcTierInfo.value || { tier: selectedTier.value }));
const calcDailyPercent = computed(() => Number(calcTierInfo.value?.dailyPercent || 0.25));
const calcTotal = (days: number) => {
  const amount = Number(calcAmount.value || 0);
  if (!amount) return "0.00";
  const total = calculateCompound(amount, calcDailyPercent.value, days);
  return (total - amount).toFixed(1);
};
const calc365 = computed(() => calcTotal(365));
const showUpgradeHint = computed(() => Number(selectedTier.value || 0) > Number(userTier.value || 0));

const nextTierInfo = computed(() => {
  if (!currentTierInfo.value) return null;
  const nextTier = (currentTierInfo.value.tier || 0) + 1;
  return tiers.value.find((item: any) => item.tier === nextTier) || null;
});

const progressPercent = computed(() => {
  if (!nextTierInfo.value) return 100;
  const personal = Number(user.value?.personalDepositSum || 0);
  const team = Number(user.value?.teamTurnoverSum || 0);
  const personalTarget = Number(nextTierInfo.value.minPersonal || 0);
  const teamTarget = Number(nextTierInfo.value.minTeam || 0);
  const personalProgress = personalTarget ? personal / personalTarget : 0;
  const teamProgress = teamTarget ? team / teamTarget : 0;
  const progress = Math.max(personalProgress, teamProgress);
  return Math.min(100, Math.max(0, Math.round(progress * 100)));
});

const personalProgressLabel = computed(() => {
  if (!nextTierInfo.value) return "100%";
  const personal = Number(user.value?.personalDepositSum || 0);
  const personalTarget = Number(nextTierInfo.value.minPersonal || 0);
  const ratio = personalTarget ? personal / personalTarget : 0;
  return `${Math.min(100, Math.max(0, Math.round(ratio * 100)))}%`;
});

const teamProgressLabel = computed(() => {
  if (!nextTierInfo.value) return "100%";
  const team = Number(user.value?.teamTurnoverSum || 0);
  const teamTarget = Number(nextTierInfo.value.minTeam || 0);
  const ratio = teamTarget ? team / teamTarget : 0;
  return `${Math.min(100, Math.max(0, Math.round(ratio * 100)))}%`;
});

const teamProgressAnimated = ref(0);
const teamProgressAnimatedLabel = computed(() => `${Math.round(teamProgressAnimated.value)}%`);

watch(
  () => teamProgressLabel.value,
  (value) => {
    const numeric = Number(String(value).replace("%", "")) || 0;
    teamProgressAnimated.value = 0;
    requestAnimationFrame(() => {
      teamProgressAnimated.value = Math.min(93, numeric);
    });
  },
  { immediate: true },
);

const recentAccruals = ref<any[]>([]);
const referralLink = ref("");

const boostActive = computed(() => {
  const until = user.value?.tierBoostUntil;
  if (!until) return false;
  const ts = new Date(until).getTime();
  return Number.isFinite(ts) && ts > Date.now();
});
const boostActiveUi = computed(
  () => boostActive.value || userTier.value > Number(user.value?.currentTier ?? 0),
);
const boostUntilLabel = computed(() => {
  const until = user.value?.tierBoostUntil;
  if (!until) return "";
  const date = new Date(until);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const locale = language.value === "ru" ? "ru-RU" : "en-US";
  const timeLabel = date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  if (sameDay) {
    return `${t("common.today")}, ${timeLabel}`;
  }
  const dateLabel = date.toLocaleDateString(locale, { month: "short", day: "numeric" });
  return `${dateLabel}, ${timeLabel}`;
});
const cheerText = computed(() => {
  const baseTier = Number(user.value?.currentTier ?? 0);
  const maxTier = Math.max(0, ...(tiers.value || []).map((item: any) => Number(item?.tier ?? 0)));
  const nextTier = Math.min(maxTier || baseTier + 1, baseTier + 1);
  if (boostActiveUi.value) {
    return t("tariffs.boostCheer", { tier: nextTier });
  }
  return t("tariffs.teamCheerDynamic", { tier: nextTier });
});
const boostButtonLabel = computed(() =>
  boostActiveUi.value ? t("tariffs.boostActiveButton") : t("tariffs.jumpTier"),
);
const canJump = computed(() => Number(user.value?.furBalance || 0) >= 1000 && !boostActiveUi.value);

const formatRecentDate = (value: string) => {
  const date = new Date(value);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const locale = language.value === "ru" ? "ru-RU" : "en-US";
  const timeLabel = date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  if (sameDay) {
    return `${t("common.today")}, ${timeLabel}`;
  }
  const dateLabel = date.toLocaleDateString(locale, { month: "short", day: "numeric" });
  return `${dateLabel}, ${timeLabel}`;
};

const jumpToTier = async () => {
  impact("light");
  if (!canJump.value) {
    showToast(boostActive.value ? t("tariffs.boostActive") : t("tariffs.jumpDisabled"));
    return;
  }
  try {
    await apiFetch("/tariffs/boost", { method: "POST" });
    showToast(t("tariffs.boostSuccess"));
    user.value = await apiFetch("/users/me");
  } catch (err: any) {
    showToast(err?.message || t("tariffs.boostFailed"));
  }
};

const copyInvite = async () => {
  if (!referralLink.value) return;
  await navigator.clipboard.writeText(referralLink.value);
  impact("light");
  showToast(t("tariffs.inviteCopied"));
};

const personalMet = computed(() => {
  if (!nextTierInfo.value) return true;
  return Number(user.value?.personalDepositSum || 0) >= Number(nextTierInfo.value.minPersonal || 0);
});

const teamMet = computed(() => {
  if (!nextTierInfo.value) return true;
  return Number(user.value?.teamTurnoverSum || 0) >= Number(nextTierInfo.value.minTeam || 0);
});
</script>

<style scoped>
.tier-scroll {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(240px, 75%);
  gap: 14px;
  overflow-x: auto;
  padding-bottom: 6px;
  scroll-snap-type: x mandatory;
}
.tier-scroll--current {
  grid-auto-columns: 1fr;
  overflow: hidden;
}
.see-all {
  margin-top: 12px;
}
.tier-remaining {
  font-size: 12px;
  color: #cfeee6;
}
.tier-badges {
  display: flex;
  gap: 6px;
  align-items: center;
}
.tier-tag {
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid #2a2733;
  color: #9a96aa;
}
.tier-tag.boost {
  border-color: rgba(255, 205, 0, 0.3);
  color: #ffd166;
  background: rgba(255, 205, 0, 0.12);
}
.tier-boost-banner {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 205, 0, 0.08);
  border: 1px solid rgba(255, 205, 0, 0.2);
}
.tier-boost-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: 700;
}
.tier-boost-label {
  font-size: 12px;
  color: #ffd166;
}
.tier-boost-value {
  font-size: 12px;
  color: #fff;
}
.tier-boost-until {
  margin-top: 4px;
  font-size: 11px;
  color: #f4e5b2;
}
.tier-boost-base {
  margin-top: 6px;
  font-size: 11px;
  color: #b7b2c8;
}
.tier-tag.current {
  color: #0b0a10;
  background: var(--accent);
  border-color: transparent;
}
.tier-tag.locked {
  color: #b0a9c6;
}
.tier-tag.passed {
  color: var(--accent);
  border-color: rgba(2, 192, 118, 0.4);
}
.calc-grid {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}
.calc-row {
  display: flex;
  justify-content: space-between;
  color: #d8d6e3;
  font-size: 13px;
}
.calc-note {
  font-size: 11px;
  color: #8d8a9b;
}
.calc-tier {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}
.calc-tier-value {
  font-weight: 700;
  color: #e4e2ee;
}
.calc-tier-range {
  width: 100%;
  height: 6px;
  appearance: none;
  background: #1f1c28;
  border-radius: 999px;
  outline: none;
}
.calc-tier-range::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid #0b0a10;
}
.calc-upgrade {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.calc-upgrade-btn {
  padding: 6px 12px;
  font-size: 11px;
}
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(6, 5, 10, 0.7);
  display: grid;
  place-items: end center;
  padding: 16px;
  z-index: 50;
}
.modal {
  width: 100%;
  max-width: 520px;
  max-height: 85vh;
  background: #151321;
  border-radius: 24px;
  padding: 16px;
  border: 1px solid #252231;
  display: grid;
  grid-template-rows: auto 1fr;
  overflow: hidden;
}
.modal-list {
  display: grid;
  gap: 12px;
  margin-top: 12px;
  overflow: auto;
  padding-bottom: 12px;
}
.tier-scroll::-webkit-scrollbar {
  display: none;
}
.tier-card {
  background: #1a1724;
  border-radius: 22px;
  padding: 16px 16px 20px;
  display: grid;
  gap: 10px;
  min-height: auto;
  border: 1px solid #252231;
  scroll-snap-align: start;
  overflow: hidden;
}
.tier-card--modal {
  padding: 14px 14px 16px;
  min-height: 170px;
  background: linear-gradient(160deg, rgba(54, 50, 68, 0.55), rgba(22, 20, 30, 0.95));
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 18px 32px rgba(0, 0, 0, 0.35);
  position: relative;
}
.tier-card--modal .tier-name {
  font-size: 15px;
}
.tier-card--modal .tier-income {
  font-size: 18px;
}
.tier-card--modal .tier-req {
  font-size: 11px;
}
.tier-card--modal .tier-badge {
  font-size: 10px;
  background: rgba(207, 238, 230, 0.08);
  border-color: rgba(207, 238, 230, 0.25);
}
.tier-card--modal .tier-req-list {
  margin-top: 4px;
  gap: 4px;
}
.tier-card--modal .tier-req-item {
  font-size: 10px;
}
.tier-card--modal::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 22px;
  background: radial-gradient(120% 120% at 100% 0%, rgba(183, 123, 255, 0.18), transparent 60%);
  opacity: 0.7;
  pointer-events: none;
}
.tier-card--current {
  background: linear-gradient(160deg, rgba(125, 244, 215, 0.2), rgba(183, 123, 255, 0.18)), #1a1724;
  border-color: transparent;
}
.tier-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.tier-name {
  font-weight: 700;
  font-size: 16px;
}
.tier-badge {
  font-size: 11px;
  color: #cfeee6;
  border: 1px solid #2a2733;
  padding: 4px 10px;
  border-radius: 999px;
}
.tier-badge--active {
  box-shadow: 0 0 8px rgba(140, 199, 255, 0.35);
  border-color: rgba(140, 199, 255, 0.5);
  color: #e6fbff;
}
.tier-income {
  font-weight: 700;
  font-size: 18px;
  color: var(--accent);
}
.tier-req {
  font-size: 12px;
  color: #8d8a9b;
}
.tier-progress-panel {
  margin-top: 8px;
  padding: 14px;
}
.tier-progress-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.tier-progress-title {
  font-weight: 700;
  font-size: 14px;
}
.tier-progress-sub {
  font-size: 12px;
  color: #8d8a9b;
}
.tier-progress-remaining {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 12px;
}
.remaining-value {
  font-weight: 800;
  color: var(--accent);
}
.tier-progress-bars {
  display: grid;
  gap: 10px;
  margin-top: 10px;
}
.tariffs-top {
  display: grid;
  gap: 8px;
}
.tier-actions {
  display: grid;
  gap: 8px;
  margin-top: 10px;
  grid-template-columns: repeat(2, 1fr);
}
.section-title--spaced {
  margin-top: 18px;
}
.jump-tier {
  margin-top: 10px;
  background: linear-gradient(135deg, #ff9f43 0%, #ff6b81 45%, #b77bff 100%);
  color: #0b0a10;
  position: relative;
  overflow: hidden;
}
.jump-tier::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(120deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.45) 50%, rgba(255, 255, 255, 0) 100%);
  transform: translateX(-120%);
  animation: jumpShimmer 2.8s infinite;
}
.jump-tier--disabled {
  opacity: 0.6;
  filter: grayscale(0.2);
  cursor: not-allowed;
}
.jump-tier--disabled::after {
  animation: none;
  opacity: 0.2;
}
.tier-progress-item {
  display: grid;
  gap: 6px;
}
.tier-progress-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #b7b3c7;
  gap: 8px;
}
.tier-progress-percent {
  color: #d8d6e3;
  font-weight: 700;
}
.tier-req-list {
  display: grid;
  gap: 8px;
  margin-top: 2px;
}
.tier-progress-bar {
  height: 8px;
  border-radius: 999px;
  background: #241f2d;
  overflow: hidden;
}
.tier-progress-bar--team {
  position: relative;
}
.tier-progress-fill {
  height: 100%;
  background: linear-gradient(135deg, var(--accent) 0%, #8cc7ff 100%);
  transition: width 0.3s ease;
}
.tier-progress-fill--violet {
  background: linear-gradient(135deg, #8cc7ff 0%, #b77bff 100%);
}
.tier-progress-fill--team {
  position: relative;
  animation: teamPulse 2.2s ease-in-out infinite;
}
.tier-progress-fill--team::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.45) 50%, rgba(255, 255, 255, 0) 100%);
  transform: translateX(-120%);
  animation: teamShimmer 1.8s linear infinite;
}
.tier-progress-cheer {
  margin-top: 8px;
  font-size: 11px;
  color: #9bd7ff;
}
.jump-tier--active {
  background: linear-gradient(135deg, #f4d06f 0%, #ffb347 50%, #ffd166 100%);
  color: #1a1410;
  border: none;
  box-shadow: 0 0 18px rgba(255, 193, 102, 0.35);
  animation: boostPulse 2.4s ease-in-out infinite;
}
.jump-tier--active.jump-tier--disabled {
  opacity: 0.75;
}
.invite-button {
  margin-top: 14px;
}
.list-item + .list-item {
  margin-top: 8px;
}
.list-amount--profit {
  color: #02c076;
  text-shadow: 0 0 8px rgba(2, 192, 118, 0.35);
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-end;
}
.list-amount-icon {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(2, 192, 118, 0.18);
  color: #02c076;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 700;
}
.tier-req-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #b7b3c7;
  line-height: 1.3;
}
.tier-req-check {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 11px;
  border: 1px solid #2f2a3a;
  color: #6f6b7c;
}
.tier-req-check.is-ok {
  border-color: var(--accent);
  color: #0b0a10;
  background: var(--accent);
}
.tier-req-list--static .tier-req-check {
  border: none;
  background: transparent;
  color: #8d8a9b;
  font-size: 14px;
}
@keyframes glow {
  0% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.7;
  }
}
@keyframes teamShimmer {
  0% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(120%);
  }
}
@keyframes teamPulse {
  0%,
  100% {
    filter: brightness(1);
  }
  50% {
    filter: brightness(1.15);
  }
}
@keyframes jumpShimmer {
  0% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(120%);
  }
}
@keyframes boostPulse {
  0%,
  100% {
    transform: translateY(0);
    box-shadow: 0 0 18px rgba(255, 193, 102, 0.3);
  }
  50% {
    transform: translateY(-1px);
    box-shadow: 0 0 26px rgba(255, 193, 102, 0.45);
  }
}
</style>
