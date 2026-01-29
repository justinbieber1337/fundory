<template>
  <section class="page">
    <div class="section-title">{{ t("profile.title") }}</div>
    <div v-if="loading" class="loading-wrap">
      <LoadingSpinner />
    </div>
    <div v-else-if="error" class="card">
      {{ error }}
      <div class="muted" style="margin-top: 6px">
        {{ t("profile.debugInit") }} {{ debugInfo.initData ? t("profile.yes") : t("profile.no") }} ·
        {{ t("profile.debugUrl") }} {{ debugInfo.urlData ? t("profile.yes") : t("profile.no") }}
      </div>
    </div>
    <div v-else class="settings-list">
      <div class="card profile-card">
        <div class="profile-row">
          <div class="avatar">{{ initials }}</div>
          <div>
            <div class="profile-name">{{ displayName }}</div>
        <div class="muted">{{ t("profile.idLabel") }} {{ telegramId }}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="muted">{{ t("profile.language") }}</div>
        <div class="pill-row">
          <button class="pill" :class="{ 'pill--active': language === 'en' }" @click="updateLanguage('en')">
            {{ t("profile.langEn") }}
          </button>
          <button class="pill" :class="{ 'pill--active': language === 'ru' }" @click="updateLanguage('ru')">
            {{ t("profile.langRu") }}
          </button>
        </div>
      </div>

      <div class="card">
        <div class="muted">{{ t("profile.notifications") }}</div>
        <div class="list" style="margin-top: 10px">
          <div class="list-item">
            <div>{{ t("profile.notifyDaily") }}</div>
            <label class="switch">
              <input v-model="notifyDaily" type="checkbox" />
              <span class="slider"></span>
            </label>
          </div>
          <div class="list-item">
            <div>{{ t("profile.notifyDeposit") }}</div>
            <label class="switch">
              <input v-model="notifyDeposit" type="checkbox" />
              <span class="slider"></span>
            </label>
          </div>
          <div class="list-item">
            <div>{{ t("profile.notifyWithdraw") }}</div>
            <label class="switch">
              <input v-model="notifyWithdraw" type="checkbox" />
              <span class="slider"></span>
            </label>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-row">
          <div class="muted">{{ t("profile.payoutAddresses") }}</div>
          <button class="icon-button add-address-btn" @click="openAddAddress">
            +
          </button>
        </div>
        <div class="list" style="margin-top: 10px">
          <div v-for="addr in addresses" :key="addr.id" class="list-item">
            <div class="address-meta">
              <div style="font-weight: 600">{{ addr.label || t("profile.addressLabel") }}</div>
              <div class="muted address-text">{{ addr.address }}</div>
            </div>
            <button class="pill" @click="removeAddress(addr.id)">{{ t("profile.remove") }}</button>
          </div>
          <div v-if="!addresses.length" class="muted">{{ t("profile.noAddresses") }}</div>
        </div>
      </div>
    </div>
    <div v-if="showAddAddress" class="modal-backdrop" @click.self="closeAddAddress">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">{{ t("profile.addNewAddress") }}</div>
          <button class="pill" @click="closeAddAddress">{{ t("common.close") }}</button>
        </div>
        <div style="display: grid; gap: 8px">
          <input v-model="newLabel" class="input" :placeholder="t('profile.label')" />
          <input
            v-model="newAddress"
            class="input address-input"
            maxlength="34"
            :placeholder="t('profile.trc20Address')"
          />
          <div v-if="formError" class="muted">{{ formError }}</div>
          <button class="button button--primary" :disabled="!canAdd" @click="addAddress">
            {{ canAdd ? t("profile.addAddress") : t("profile.maxAddresses") }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useNuxtApp } from "nuxt/app";
import { useApi } from "../composables/useApi";
import { useAuth } from "../composables/useAuth";
import { useI18n } from "../composables/useI18n";
const { apiFetch } = useApi();
const { token, loadToken, ensureToken } = useAuth();
const { $telegram } = useNuxtApp() as any;
const { t, language, setLanguage } = useI18n();

const profile = ref<any>(null);
const addresses = ref<any[]>([]);
const newAddress = ref("");
const newLabel = ref("");
const loading = ref(true);
const error = ref<string | null>(null);
const formError = ref<string | null>(null);

const notifyDaily = ref(true);
const notifyDeposit = ref(true);
const notifyWithdraw = ref(true);
const isReady = ref(false);
const showAddAddress = ref(false);


const refresh = async () => {
  const [profileData, addressData] = await Promise.all([
    apiFetch<any>("/users/me"),
    apiFetch<any[]>("/users/payout-addresses"),
  ]);
  profile.value = profileData;
  addresses.value = addressData;
  if (profile.value?.language && ["en", "ru"].includes(profile.value.language)) {
    setLanguage(profile.value.language);
  }
  notifyDaily.value = profile.value?.notifyDailyProfit ?? true;
  notifyDeposit.value = profile.value?.notifyDeposit ?? true;
  notifyWithdraw.value = profile.value?.notifyWithdraw ?? true;
};

const updateLanguage = async (lang: "en" | "ru") => {
  setLanguage(lang);
  if (!token.value) return;
  try {
    await apiFetch("/users/me", { method: "PATCH", body: { language: lang } });
  } catch (err: any) {
    error.value = err?.message || t("profile.languageUpdateFailed");
  }
};

const addAddress = async () => {
  formError.value = null;
  if (!token.value) {
    await ensureToken();
  }
  if (!token.value) {
    formError.value = t("profile.authRequired");
    return;
  }
  if (addresses.value.length >= 3) {
    formError.value = t("profile.limitReached");
    return;
  }
  const address = newAddress.value.trim();
  const label = newLabel.value.trim();
  const tronRegex = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
  if (!tronRegex.test(address)) {
    formError.value = t("profile.invalidAddress");
    return;
  }
  try {
    await apiFetch("/users/payout-addresses", {
      method: "POST",
      body: { address, label },
    });
    newAddress.value = "";
    newLabel.value = "";
    await refresh();
    closeAddAddress();
  } catch (err: any) {
    formError.value = err?.message || t("profile.invalidAddress");
  }
};

const removeAddress = async (id: string) => {
  await apiFetch(`/users/payout-addresses/${id}`, { method: "DELETE" });
  await refresh();
};

onMounted(async () => {
  $telegram?.ready?.();
  $telegram?.expand?.();
  const savedLang = typeof localStorage !== "undefined" ? localStorage.getItem("ui_language") : null;
  if (!savedLang) {
    const tgLang = telegramUser.value?.language_code;
    if (tgLang === "en" || tgLang === "ru") {
      setLanguage(tgLang);
    }
  }
  loadToken();
  try {
    if (!token.value) {
      await ensureToken();
    }
    if (!token.value) {
      error.value = t("profile.authRequired");
      loading.value = false;
      return;
    }
    await refresh();
    isReady.value = true;
  } catch (err: any) {
    error.value = err?.message || t("profile.profileLoadFailed");
  } finally {
    loading.value = false;
  }
});

const telegramUser = computed(() => $telegram?.initDataUnsafe?.user || null);
const { displayName, initials, telegramId } = useUserDisplay(profile, {
  fallbackUser: telegramUser,
  fallbackName: () => t("profile.accountFallback"),
});
const debugInfo = computed(() => {
  if (typeof window === "undefined") return { initData: false, urlData: false };
  const direct = $telegram?.initData;
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const urlData =
    searchParams.has("tgWebAppData") ||
    searchParams.has("initData") ||
    hashParams.has("tgWebAppData") ||
    hashParams.has("initData");
  return { initData: Boolean(direct && direct.length > 0), urlData };
});

const canAdd = computed(() => addresses.value.length < 3);

const openAddAddress = () => {
  formError.value = null;
  showAddAddress.value = true;
};

const closeAddAddress = () => {
  showAddAddress.value = false;
};

watch([notifyDaily, notifyDeposit, notifyWithdraw], async () => {
  if (!isReady.value) return;
  if (!token.value) return;
  try {
    await apiFetch("/users/me", {
      method: "PATCH",
      body: {
        notifyDailyProfit: notifyDaily.value,
        notifyDeposit: notifyDeposit.value,
        notifyWithdraw: notifyWithdraw.value,
      },
    });
  } catch (err: any) {
    error.value = err?.message || t("profile.notificationsUpdateFailed");
  }
});
</script>

<style scoped>
.settings-list {
  display: grid;
  gap: 12px;
}
.profile-card {
  padding: 18px;
}
.profile-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #2b2635;
  display: grid;
  place-items: center;
  font-weight: 700;
  color: #c7c3d6;
}
.profile-name {
  font-weight: 700;
  font-size: 16px;
}
.pill-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}
.pill--active {
  border-color: var(--accent);
  color: var(--accent);
}
.address-meta {
  min-width: 0;
}
.address-text {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.address-input {
  font-size: 12px;
  letter-spacing: -0.2px;
}
.add-address-btn {
  width: 36px;
  height: 36px;
  font-weight: 900;
  font-size: 16px;
  color: var(--accent);
  border: 1px solid rgba(2, 192, 118, 0.45);
  box-shadow: 0 0 0 3px rgba(2, 192, 118, 0.12);
}
.switch {
  position: relative;
  display: inline-block;
  width: 42px;
  height: 24px;
}
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #2a2733;
  border-radius: 999px;
  transition: 0.2s;
}
.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  top: 3px;
  background: #f3f3f6;
  border-radius: 50%;
  transition: 0.2s;
}
.switch input:checked + .slider {
  background: var(--accent);
}
.switch input:checked + .slider:before {
  transform: translateX(18px);
}
</style>
