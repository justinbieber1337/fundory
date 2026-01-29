<template>
  <section class="page">
    <div class="section-title">{{ t("balance.title") }}</div>
    <div v-if="loading" class="loading-wrap">
      <LoadingSpinner />
    </div>
    <div v-else-if="error" class="card">{{ error }}</div>
    <div v-else>
      <div class="card deposit-card">
        <div class="muted">{{ t("balance.addressLabel") }}</div>
        <div class="address-row">
          <div class="address-text">{{ wallet?.address }}</div>
          <button class="button button--primary" @click="copyAddress">{{ t("balance.copyAddress") }}</button>
        </div>
        <div class="deposit-warning">{{ t("balance.warning") }}</div>
        <button class="button button--ghost" :disabled="scanning" @click="scanDeposit">
          {{ scanning ? t("balance.scanLoading") : t("balance.scanButton") }}
        </button>
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

const wallet = ref<any>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const scanning = ref(false);

const copyAddress = async () => {
  if (wallet.value?.address) {
    await navigator.clipboard.writeText(wallet.value.address);
    impact("light");
    showToast(t("balance.copySuccess"));
  }
};

const scanDeposit = async () => {
  scanning.value = true;
  try {
    const result = await apiFetch<{ processedCount: number }>("/wallets/deposit/scan", {
      method: "POST",
    });
    if ((result?.processedCount || 0) > 0) {
      showToast(t("balance.scanFound", { count: result.processedCount }));
    } else {
      showToast(t("balance.scanEmpty"));
    }
  } catch (err: any) {
    showToast(err?.message || t("balance.scanFailed"));
  } finally {
    scanning.value = false;
  }
};

onMounted(async () => {
  loadToken();
  if (!token.value) return;
  try {
    wallet.value = await apiFetch("/wallets/deposit");
  } catch (err: any) {
    error.value = err?.message || t("balance.failed");
  } finally {
    loading.value = false;
  }
});

</script>

<style scoped>
.deposit-card {
  display: grid;
  gap: 12px;
}
.address-row {
  display: grid;
  gap: 10px;
}
.address-text {
  font-weight: 600;
  word-break: break-all;
}
.deposit-warning {
  font-size: 12px;
  color: #b7b3c7;
}
</style>
