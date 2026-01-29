<template>
  <section class="page">
    <div class="section-title">{{ t("sent.title") }}</div>
    <div v-if="loading" class="loading-wrap">
      <LoadingSpinner />
    </div>
    <div v-else-if="error" class="card">{{ error }}</div>
    <div v-else>
      <div class="card form-card">
        <div class="muted">{{ t("sent.withdrawTitle") }}</div>
        <div class="muted note-text">{{ t("sent.withdrawProfitOnly") }}</div>
        <div class="muted note-text">
          {{ t("sent.availableProfit", { amount: formatAmountOrPlaceholder(availableBalance, true) }) }}
        </div>
        <div class="form-grid">
          <input v-model="amount" class="input" inputmode="decimal" :placeholder="t('sent.amountPlaceholder')" />
          <input v-model="address" class="input" :placeholder="t('sent.addressPlaceholder')" />
          <div v-if="formError" class="muted error-text">{{ formError }}</div>
          <div v-else-if="showInsufficient" class="muted error-text">{{ t("sent.insufficient") }}</div>
          <div v-else-if="showBelowMin" class="muted error-text">{{ t("sent.minAmount") }}</div>
          <button class="button button--primary" :disabled="submitting || !canSubmit" @click="submit">
            {{ submitting ? t("sent.sending") : t("common.send") }}
          </button>
        </div>
      </div>

      <div class="section-title section-title--small">{{ t("sent.recent") }}</div>
      <div class="list">
        <div v-for="item in sentItems" :key="item.id" class="tx-row">
          <div class="tx-icon">{{ txIcon(item) }}</div>
          <div class="tx-info">
            <div class="tx-title">{{ t("sent.title") }}</div>
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
        <div v-if="!sentItems.length" class="card empty-banner">
          <div class="empty-title">{{ t("sent.emptyTitle") }}</div>
          <div class="muted">{{ t("sent.emptyText") }}</div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useApi } from "../composables/useApi";
import { useAuth } from "../composables/useAuth";
import { useHaptics } from "../composables/useHaptics";
import { useToast } from "../composables/useToast";
import { useI18n } from "../composables/useI18n";

const { apiFetch } = useApi();
const { token, loadToken } = useAuth();
const { impact } = useHaptics();
const { showToast } = useToast();
const { t } = useI18n();
const { formatAmountOrPlaceholder } = useFormatting();
const { statusClass, displayCurrency, formatSignedAmount } = useTransactionUtils();

const items = ref<any[]>([]);
const balances = ref<any>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const amount = ref("");
const address = ref("");
const formError = ref<string | null>(null);
const submitting = ref(false);
const page = ref(1);
const pageSize = 20;
const hasMore = ref(true);
const loadingMore = ref(false);

const txIcon = (item: any) => {
  const status = String(item?.status || "").toLowerCase();
  if (status === "pending") return "⏳";
  if (status === "failed" || status === "canceled") return "❌";
  return "↗";
};

const sentItems = computed(() =>
  items.value.filter((item) => {
    const type = String(item?.type || "").toLowerCase();
    return type === "withdraw_out" || type === "withdraw" || type === "transfer_out";
  }),
);

const tronRegex = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const minWithdrawal = 10;
const availableBalance = computed(() => Number(balances.value?.profitAvailable || 0));
const numericAmount = computed(() => Number(amount.value.replace(",", ".")));
const trimmedAddress = computed(() => address.value.trim());
const canSubmit = computed(
  () =>
    Number.isFinite(numericAmount.value) &&
    numericAmount.value >= minWithdrawal &&
    numericAmount.value <= availableBalance.value &&
    tronRegex.test(trimmedAddress.value),
);
const showInsufficient = computed(
  () =>
    Number.isFinite(numericAmount.value) &&
    numericAmount.value >= minWithdrawal &&
    numericAmount.value > availableBalance.value,
);
const showBelowMin = computed(
  () => Number.isFinite(numericAmount.value) && numericAmount.value > 0 && numericAmount.value < minWithdrawal,
);

const ensureBalances = async () => {
  if (balances.value) return;
  balances.value = await apiFetch("/balances");
};

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
      error.value = err?.message || t("sent.failedLoad");
    } else {
      showToast(err?.message || t("sent.failedLoad"));
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

const submit = async () => {
  formError.value = null;
  if (!token.value) {
    formError.value = t("home.openInTelegram");
    return;
  }
  await ensureBalances();
  const numeric = Number(amount.value.replace(",", "."));
  if (!Number.isFinite(numeric) || numeric < minWithdrawal) {
    formError.value = t("sent.minAmount");
    return;
  }
  if (!tronRegex.test(trimmedAddress.value)) {
    formError.value = t("sent.invalidAddress");
    return;
  }
  if (!Number.isFinite(availableBalance.value)) {
    formError.value = t("sent.failedLoad");
    return;
  }
  if (numeric > availableBalance.value) {
    formError.value = t("sent.insufficient");
    return;
  }
  submitting.value = true;
  try {
    await apiFetch("/withdrawals/request", {
      method: "POST",
      body: { amount: numeric, address: trimmedAddress.value },
    });
    amount.value = "";
    showToast(t("sent.success"));
    impact("light");
    page.value = 1;
    await loadPage(true);
    balances.value = await apiFetch("/balances");
  } catch (err: any) {
    formError.value = err?.message || t("sent.failed");
  } finally {
    submitting.value = false;
  }
};


onMounted(async () => {
  loadToken();
  if (!token.value) return;
  try {
    page.value = 1;
    await loadPage(true);
    balances.value = await apiFetch("/balances");
  } catch (err: any) {
    error.value = err?.message || t("sent.failedLoad");
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
.list-more {
  margin-top: 6px;
}
.error-text {
  color: #ff7a7a;
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
.form-card {
  display: grid;
  gap: 10px;
}
.form-grid {
  display: grid;
  gap: 10px;
  margin-top: 6px;
}
.section-title--small {
  font-size: 14px;
  margin-top: 12px;
}
</style>
