<template>
  <section class="page">
    <div class="section-title">{{ t("ref.title") }}</div>
    <div v-if="loading" class="loading-wrap">
      <LoadingSpinner />
    </div>
    <div v-else-if="error" class="card">{{ error }}</div>
    <div v-else>
      <div class="card section-gap">
        <div class="muted">{{ t("ref.linkTitle") }}</div>
        <div class="ref-link">
          <div class="ref-text">{{ stats?.referralLink }}</div>
          <button class="pill" @click="copyLink">{{ t("common.copy") }}</button>
        </div>
      </div>

      <div class="stats-grid section-gap">
        <div class="list-item stat-row">
          <div class="stat-left">
            <div class="stat-label">{{ t("ref.invited") }}</div>
            <div class="stat-sub">{{ t("ref.allTime") }}</div>
          </div>
          <div class="stat-right">
            <div class="stat-value">{{ stats?.totalReferrals || 0 }}</div>
          </div>
        </div>
        <div class="list-item stat-row">
          <div class="stat-left">
            <div class="stat-label">{{ t("ref.turnover") }}</div>
            <div class="stat-sub">USDT</div>
          </div>
          <div class="stat-right">
            <div class="stat-value">
              {{ formatAmountOrPlaceholder(stats?.referralsTurnover || 0, hasFunds) }}
            </div>
          </div>
        </div>
      </div>

      <div class="card section-gap">
        <div class="earnings-header">
          <div>
            <div class="stat-label">{{ t("ref.earnings") }}</div>
            <div class="stat-sub">FUR</div>
          </div>
          <div class="earnings-value">
            {{ formatAmountOrPlaceholder(stats?.referralAvailable || 0, hasFunds) }}
          </div>
        </div>
        <div class="earnings-meta">
          <div class="muted">{{ t("ref.pending") }}</div>
          <div>{{ formatAmountOrPlaceholder(stats?.referralPending || 0, hasFunds) }} FUR</div>
        </div>
        <div class="earnings-meta">
          <div class="muted">{{ t("ref.available") }}</div>
          <div>{{ formatAmountOrPlaceholder(stats?.referralAvailable || 0, hasFunds) }} FUR</div>
        </div>

        <div class="progress-row">
          <div class="unlock-track">
            <div class="unlock-fill" :style="{ width: `${progressPercent}%` }"></div>
          </div>
          <div class="unlock-label">{{ activeRefs }}/3</div>
        </div>
        <div class="muted hint-text">
          {{ t("ref.activeProgress", { current: activeRefs, total: 3 }) }}
        </div>

        <div class="claim-row">
          <button class="button button--primary claim-button" :disabled="!canClaim" @click="claimAll">
            {{ t("ref.claimAll") }}
          </button>
        </div>

        <div v-if="activeRefs < 3" class="muted hint-text">
          {{ t("ref.needActive", { count: Math.max(0, 3 - activeRefs) }) }}
        </div>
      </div>

      <div class="card section-gap">
        <div class="ref-tabs">
          <button
            class="pill"
            :class="{ 'pill--active': activeTab === 'my' }"
            @click="activeTab = 'my'"
          >
            {{ t("ref.myReferralsTab") }}
          </button>
          <button
            class="pill"
            :class="{ 'pill--active': activeTab === 'leaderboard' }"
            @click="activeTab = 'leaderboard'"
          >
            {{ t("ref.leaderboardTab") }}
          </button>
        </div>

        <div v-if="activeTab === 'my'" class="list" style="margin-top: 12px">
          <div
            v-for="ref in visibleReferrals"
            :key="ref.id"
            class="list-item ref-item"
            @click="openChildren(ref)"
          >
            <div>
              <div style="font-weight: 600">{{ ref.name }}</div>
              <div class="muted ref-meta">
                <span>{{ t("ref.tariffLabel", { tariff: ref.tariff }) }}</span>
                <span class="ref-sep">•</span>
                <span>{{ t("ref.referralsCount", { count: ref.referralsCount || 0 }) }}</span>
              </div>
            </div>
            <div class="muted">{{ ref.hasDeposit ? t("ref.active") : t("ref.noDeposit") }}</div>
          </div>
          <div v-if="!(stats?.referrals || []).length" class="muted">{{ t("ref.noneYet") }}</div>
          <button
            v-if="showMoreReferrals"
            class="button button--ghost button-full list-more"
            @click="loadMoreReferrals"
          >
            {{ t("common.loadMore") }}
          </button>
        </div>

        <div v-else class="list" style="margin-top: 12px">
          <div
            v-for="item in visibleLeaderboard"
            :key="item.id"
            class="list-item leaderboard-item"
            :class="`leaderboard-top-${item.rank}`"
          >
            <div class="leaderboard-left">
              <div class="leaderboard-rank">{{ item.rank }}</div>
              <div>
                <div style="font-weight: 600">{{ item.name }}</div>
                <div class="muted">{{ t("ref.turnoverLabel") }}</div>
              </div>
            </div>
            <div class="leaderboard-right">
              <div class="leaderboard-value">{{ formatAmount(item.turnover || 0) }}</div>
              <div class="muted">USDT</div>
            </div>
          </div>
          <div v-if="!leaderboard.length" class="muted">{{ t("ref.noneYet") }}</div>
          <button
            v-if="showMoreLeaderboard"
            class="button button--ghost button-full list-more"
            @click="loadMoreLeaderboard"
          >
            {{ t("common.loadMore") }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showChildren" class="modal-backdrop" @click.self="closeChildren">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">
            {{ t("ref.childrenTitle", { name: selectedRef?.name || "" }) }}
          </div>
          <button class="pill" @click="closeChildren">{{ t("common.close") }}</button>
        </div>
        <div v-if="childrenLoading" class="loading-wrap">
          <LoadingSpinner />
        </div>
        <div v-else class="list">
          <div v-for="child in visibleChildren" :key="child.id" class="list-item">
            <div>
              <div style="font-weight: 600">{{ child.name }}</div>
              <div class="muted ref-meta">
                <span>{{ t("ref.tariffLabel", { tariff: child.tariff }) }}</span>
                <span class="ref-sep">•</span>
                <span>{{ t("ref.referralsCount", { count: child.referralsCount || 0 }) }}</span>
              </div>
            </div>
            <div class="muted">{{ child.hasDeposit ? t("ref.active") : t("ref.noDeposit") }}</div>
          </div>
          <div v-if="!childrenList.length" class="muted">{{ t("ref.noneYet") }}</div>
          <button
            v-if="showMoreChildren"
            class="button button--ghost button-full list-more"
            @click="loadMoreChildren"
          >
            {{ t("common.loadMore") }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const { apiFetch } = useApi();
const { token, loadToken } = useAuth();
const { impact } = useHaptics();
const { showToast } = useToast();
const { t } = useI18n();
const { formatAmount, formatAmountOrPlaceholder } = useFormatting();

const stats = ref<any>(null);
const leaderboard = ref<any[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const activeTab = ref<"my" | "leaderboard">("my");
const showChildren = ref(false);
const childrenList = ref<any[]>([]);
const childrenLoading = ref(false);
const selectedRef = ref<any>(null);
const referralPageSize = 12;
const leaderboardPageSize = 15;
const childrenPageSize = 12;
const visibleRefCount = ref(referralPageSize);
const visibleLeaderboardCount = ref(leaderboardPageSize);
const visibleChildrenCount = ref(childrenPageSize);
const canWithdraw = computed(() => (stats.value?.referralsWithDeposit || 0) >= 3);
const activeRefs = computed(() => stats.value?.referralsWithDeposit || 0);
const availableAmount = computed(() => Number(stats.value?.referralAvailable || 0));
const canClaim = computed(() => canWithdraw.value && availableAmount.value > 0);
const hasFunds = computed(
  () =>
    Number(stats.value?.referralPending || 0) > 0 ||
    Number(stats.value?.referralAvailable || 0) > 0 ||
    Number(stats.value?.referralsTurnover || 0) > 0,
);
const progressPercent = computed(() => Math.min(100, (activeRefs.value / 3) * 100));
const referralsList = computed(() => stats.value?.referrals || []);
const visibleReferrals = computed(() => referralsList.value.slice(0, visibleRefCount.value));
const showMoreReferrals = computed(() => visibleRefCount.value < referralsList.value.length);
const visibleLeaderboard = computed(() => leaderboard.value.slice(0, visibleLeaderboardCount.value));
const showMoreLeaderboard = computed(() => visibleLeaderboardCount.value < leaderboard.value.length);
const visibleChildren = computed(() => childrenList.value.slice(0, visibleChildrenCount.value));
const showMoreChildren = computed(() => visibleChildrenCount.value < childrenList.value.length);

const copyLink = async () => {
  if (!stats.value?.referralLink) return;
  await navigator.clipboard.writeText(stats.value.referralLink);
  impact("light");
  showToast(t("common.copied"));
};

const claimAll = async () => {
  try {
    await apiFetch("/referrals/claim", { method: "POST" });
    stats.value = await apiFetch("/referrals/stats");
    showToast(t("ref.claimSuccess"));
  } catch (err: any) {
    showToast(err?.message || t("ref.claimFailed"));
  }
};

const openChildren = async (ref: any) => {
  if (!ref?.userId) return;
  selectedRef.value = ref;
  showChildren.value = true;
  childrenLoading.value = true;
  visibleChildrenCount.value = childrenPageSize;
  try {
    childrenList.value = await apiFetch(`/referrals/children/${ref.userId}`);
  } catch (err: any) {
    childrenList.value = [];
    showToast(err?.message || t("ref.failed"));
  } finally {
    childrenLoading.value = false;
  }
};

const closeChildren = () => {
  showChildren.value = false;
  selectedRef.value = null;
  childrenList.value = [];
};

const loadMoreReferrals = () => {
  visibleRefCount.value += referralPageSize;
};

const loadMoreLeaderboard = () => {
  visibleLeaderboardCount.value += leaderboardPageSize;
};

const loadMoreChildren = () => {
  visibleChildrenCount.value += childrenPageSize;
};

watch(activeTab, (value) => {
  if (value === "my") {
    visibleRefCount.value = referralPageSize;
  } else {
    visibleLeaderboardCount.value = leaderboardPageSize;
  }
});

onMounted(async () => {
  loadToken();
  if (!token.value) return;
  try {
    const [statsRes, leaderboardRes] = await Promise.all([
      apiFetch("/referrals/stats"),
      apiFetch("/referrals/leaderboard"),
    ]);
    stats.value = statsRes;
    leaderboard.value = leaderboardRes || [];
    visibleRefCount.value = referralPageSize;
    visibleLeaderboardCount.value = leaderboardPageSize;
  } catch (err: any) {
    error.value = err?.message || t("ref.failed");
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.ref-link {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 6px;
}
.ref-text {
  font-weight: 700;
  font-size: 12px;
  word-break: break-all;
  flex: 1;
}
.stats-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  margin-top: 16px;
  margin-bottom: 12px;
}
.stat-row {
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.stat-left {
  display: grid;
  gap: 4px;
}
.stat-right {
  text-align: right;
}
.stat-label {
  font-weight: 600;
  font-size: 12px;
}
.stat-value {
  font-weight: 700;
  font-size: 15px;
}
.stat-sub {
  color: #8d8a9b;
  font-size: 11px;
}
.ref-tabs {
  display: inline-flex;
  gap: 6px;
  padding: 4px;
  border-radius: 999px;
  background: #17151f;
  border: 1px solid #232031;
}
.ref-tabs .pill {
  padding: 6px 16px;
  border-radius: 999px;
  background: transparent;
  font-weight: 700;
  color: #bdb8cc;
  border: 1px solid transparent;
}
.ref-tabs .pill--active {
  background: rgba(2, 192, 118, 0.18);
  color: var(--accent);
  border-color: rgba(2, 192, 118, 0.35);
}
.ref-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.ref-sep {
  color: #5b556f;
}
.leaderboard-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.leaderboard-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.leaderboard-rank {
  min-width: 28px;
  height: 28px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-weight: 800;
  background: #242031;
  color: #d7d3e6;
}
.leaderboard-right {
  text-align: right;
}
.leaderboard-value {
  font-weight: 800;
  color: var(--accent);
  font-size: 13px;
}
.leaderboard-top-1,
.leaderboard-top-2,
.leaderboard-top-3 {
  background: linear-gradient(135deg, rgba(2, 192, 118, 0.15), rgba(18, 15, 26, 0.9));
  border: 1px solid rgba(2, 192, 118, 0.3);
}
.leaderboard-top-1 .leaderboard-rank {
  background: rgba(2, 192, 118, 0.25);
  color: var(--accent);
}
.leaderboard-top-2 .leaderboard-rank,
.leaderboard-top-3 .leaderboard-rank {
  background: rgba(180, 160, 255, 0.2);
  color: #dcd7ff;
}
.list-more {
  margin-top: 8px;
}
.ref-item {
  cursor: pointer;
}
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(7, 6, 12, 0.7);
  backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  z-index: 50;
  padding: 16px;
}
.modal {
  width: 100%;
  max-width: 480px;
  background: #14121c;
  border-radius: 18px;
  border: 1px solid #262234;
  padding: 16px;
  display: grid;
  gap: 12px;
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.modal-title {
  font-weight: 700;
}
.earnings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.earnings-value {
  font-weight: 800;
  font-size: 20px;
}
.earnings-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  margin-top: 6px;
}
.progress-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}
.claim-row {
  display: flex;
  align-items: center;
  justify-content: stretch;
  margin-top: 10px;
}
.claim-button {
  white-space: nowrap;
  padding: 10px 16px;
  width: 100%;
}
.withdraw-hint {
  color: #8d8a9b;
  font-size: 12px;
  white-space: nowrap;
}
.section-gap {
  margin-top: 14px;
}
.section-gap.card {
  padding: 12px;
}
.unlock-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
}
.unlock-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}
.unlock-track {
  position: relative;
  flex: 1;
  height: 10px;
  background: #1f1c29;
  border-radius: 999px;
  border: 1px solid #2a2733;
  overflow: hidden;
}
.unlock-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--accent) 0%, #b77bff 100%);
  transition: width 0.25s ease;
}
.unlock-label {
  font-size: 12px;
  color: #8d8a9b;
  min-width: 36px;
  text-align: right;
}
.hint-text {
  margin-top: 8px;
}
</style>
