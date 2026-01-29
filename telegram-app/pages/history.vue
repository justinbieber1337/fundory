<template>
  <section class="page">
    <div class="section-title">{{ t("common.transaction") }}</div>
    <div v-if="loading" class="loading-wrap">
      <LoadingSpinner />
    </div>
    <div v-else-if="error" class="card">{{ error }}</div>
    <div v-else class="list">
      <div v-for="item in items" :key="item.id" class="tx-row">
        <div class="tx-icon">{{ txIcon(item) }}</div>
        <div class="tx-info">
          <div class="tx-title">{{ txTitle(item) }}</div>
          <div class="muted">{{ new Date(item.createdAt).toLocaleString() }}</div>
          <div :class="['tx-status', statusClass(item.status)]">
            {{ item.status }}
          </div>
        </div>
          <div class="tx-amount">
            <div class="tx-value">{{ formatSignedAmount(item) }} {{ displayCurrency(item.currency) }}</div>
          </div>
      </div>
      <button
        v-if="hasMore"
        class="button button--ghost button-full list-more"
        :disabled="loadingMore"
        @click="loadMore"
      >
        {{ t("common.loadMore") }}
      </button>
      <div v-if="!items.length" class="card empty-banner">
        <div class="empty-title">{{ t("history.emptyTitle") }}</div>
        <div class="muted">{{ t("history.emptyText") }}</div>
        <NuxtLink to="/balance" class="button button--primary button-full" @click="impact()">
          {{ t("history.goDeposit") }}
        </NuxtLink>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const { apiFetch } = useApi();
const { impact } = useHaptics();
const { token, loadToken } = useAuth();
const { t } = useI18n();
const { statusClass, txTitle, txIcon, displayCurrency, formatSignedAmount } = useTransactionUtils();

const items = ref<any[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const page = ref(1);
const pageSize = 20;
const hasMore = ref(true);
const loadingMore = ref(false);

const loadPage = async (reset = false) => {
  if (loadingMore.value) return;
  loadingMore.value = true;
  try {
    const result = await apiFetch(`/transactions?page=${page.value}&pageSize=${pageSize}`);
    const data = Array.isArray(result) ? result : [];
    if (reset) {
      items.value = data;
    } else {
      items.value = [...items.value, ...data];
    }
    hasMore.value = data.length === pageSize;
  } catch (err: any) {
    if (reset) {
      error.value = err?.message || t("history.failed");
    }
  } finally {
    loadingMore.value = false;
  }
};

const loadMore = async () => {
  if (!hasMore.value) return;
  page.value += 1;
  await loadPage();
};

onMounted(async () => {
  loadToken();
  if (!token.value) return;
  try {
    page.value = 1;
    await loadPage(true);
  } catch (err: any) {
    error.value = err?.message || t("history.failed");
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.tx-row {
  display: grid;
  grid-template-columns: 44px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border-radius: 18px;
  background: #17151f;
}
.tx-icon {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #242031;
  display: grid;
  place-items: center;
  color: var(--accent);
  font-weight: 700;
}
.tx-title {
  font-weight: 600;
}
.tx-amount {
  text-align: right;
}
.tx-value {
  font-weight: 700;
}
.tx-status {
  font-size: 12px;
  margin-top: 4px;
}
.tx-status--ok {
  color: var(--accent);
}
.tx-status--bad {
  color: #ff7a7a;
}
.tx-status--pending {
  color: #f0c66a;
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
.list-more {
  margin-top: 6px;
}
</style>
