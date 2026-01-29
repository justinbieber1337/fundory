<template>
  <section class="page">
    <div class="section-title">{{ t("admin.title") }}</div>
    <div v-if="loading" class="loading-wrap">
      <LoadingSpinner />
    </div>
    <div v-else-if="!isAdmin" class="card">{{ t("admin.onlyAdmin") }}</div>
    <div v-else class="card">
      <div class="form-grid">
        <input v-model="targetUserId" class="input" :placeholder="t('admin.targetUserId')" />
        <input v-model="mainBalance" class="input" :placeholder="t('admin.mainBalance')" />
        <button class="button button--primary" :disabled="submitting || !canSubmit" @click="submit">
          {{ t("admin.apply") }}
        </button>
        <div v-if="message" class="muted">{{ message }}</div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useApi } from "../composables/useApi";
import { useAuth } from "../composables/useAuth";
import { useI18n } from "../composables/useI18n";

const { apiFetch } = useApi();
const { ensureToken } = useAuth();
const { t } = useI18n();
const config = useRuntimeConfig();

const loading = ref(true);
const submitting = ref(false);
const isAdmin = ref(false);
const message = ref("");

const targetUserId = ref("");
const mainBalance = ref("");

const hasTarget = computed(() => targetUserId.value.trim());
const hasBalance = computed(() => mainBalance.value.trim());
const canSubmit = computed(() => Boolean(hasTarget.value && hasBalance.value));

const submit = async () => {
  message.value = "";
  submitting.value = true;
  try {
    await apiFetch("/admin-tools/balance", {
      method: "POST",
      body: {
        targetUserId: targetUserId.value.trim() || undefined,
        mainBalance: mainBalance.value.trim() || undefined,
      },
    });
    message.value = t("admin.success");
  } catch (err: any) {
    const apiMessage =
      err?.data?.message || err?.response?._data?.message || err?.response?.data?.message || err?.message;
    message.value = apiMessage || t("admin.failed");
  } finally {
    submitting.value = false;
  }
};

onMounted(async () => {
  await ensureToken();
  try {
    const profile = await apiFetch<any>("/users/me");
    const adminId = String(config.public.adminTelegramId || "");
    isAdmin.value = Boolean(adminId && String(profile?.telegramId) === adminId);
  } catch {
    isAdmin.value = false;
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.form-grid {
  display: grid;
  gap: 10px;
  margin-top: 8px;
}
</style>
