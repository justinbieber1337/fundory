<template>
  <div class="app">
    <main class="main page">
      <NuxtPage :transition="{ name: 'page', mode: 'out-in' }" />
    </main>
    <nav class="bottom-nav">
      <NuxtLink to="/" class="nav-item" :aria-label="t('common.wallet')">
        <svg viewBox="0 0 24 24" class="nav-icon" aria-hidden="true">
          <path d="M3 10.5L12 3l9 7.5v9A1.5 1.5 0 0 1 19.5 21H4.5A1.5 1.5 0 0 1 3 19.5v-9Z" fill="none" stroke="currentColor" stroke-width="1.6" />
        </svg>
      </NuxtLink>
      <NuxtLink to="/tariffs" class="nav-item" :aria-label="t('common.swap')">
        <svg viewBox="0 0 24 24" class="nav-icon" aria-hidden="true">
          <path d="M4 6h16M7 12h10M10 18h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      </NuxtLink>
      <NuxtLink to="/analytics" class="nav-item nav-item--center" :aria-label="t('common.analytics')">
        <svg viewBox="0 0 24 24" class="nav-icon" aria-hidden="true">
          <path d="M4 16l4-4 4 3 4-6 4 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </NuxtLink>
      <NuxtLink to="/referrals" class="nav-item" :aria-label="t('common.referrals')">
        <svg viewBox="0 0 24 24" class="nav-icon" aria-hidden="true">
          <path d="M7 8a3 3 0 1 0 3-3 3 3 0 0 0-3 3Zm8 0a3 3 0 1 0 3-3 3 3 0 0 0-3 3Zm-6 9a5 5 0 0 1 10 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      </NuxtLink>
      <NuxtLink
        v-if="isAdmin"
        to="/admin-balance"
        class="nav-item"
        :aria-label="t('common.admin')"
      >
        <svg viewBox="0 0 24 24" class="nav-icon" aria-hidden="true">
          <path d="M12 3l7 3v6c0 4.4-3 7.8-7 9-4-1.2-7-4.6-7-9V6l7-3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </NuxtLink>
      <NuxtLink to="/profile" class="nav-item" :aria-label="t('common.settings')">
        <svg viewBox="0 0 24 24" class="nav-icon" aria-hidden="true">
          <circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="1.6" />
          <path d="M5 20a7 7 0 0 1 14 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      </NuxtLink>
    </nav>
    <button class="global-faq" @click="showFaq = true">?</button>
    <div v-if="showFaq" class="modal-backdrop" @click.self="showFaq = false">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">{{ t("faq.title") }}</div>
          <button class="pill" @click="showFaq = false">{{ t("common.close") }}</button>
        </div>
        <div class="list">
          <div v-for="(item, idx) in faqItems" :key="item.title" class="card faq-item">
            <button class="faq-toggle" @click="toggleFaq(idx)">
              <span>{{ t(item.title) }}</span>
              <span class="faq-icon" :class="{ open: openFaqIndex === idx }">+</span>
            </button>
            <div v-if="openFaqIndex === idx" class="muted faq-body">
              {{ t(item.body) }}
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-if="toast.visible" class="toast">{{ toast.message }}</div>
  </div>
</template>

<script setup lang="ts">
const { toast } = useToast();
const { t } = useI18n();
const { apiFetch } = useApi();
const { ensureToken } = useAuth();
const config = useRuntimeConfig();

const isAdmin = useState<boolean>("is-admin", () => false);
const showFaq = ref(false);
const openFaqIndex = ref<number | null>(null);
const faqItems = useFaqItems();

const toggleFaq = (idx: number) => {
  openFaqIndex.value = openFaqIndex.value === idx ? null : idx;
};

onMounted(async () => {
  await ensureToken();
  try {
    const profile = await apiFetch<any>("/users/me");
    const adminId = String(config.public.adminTelegramId || "");
    isAdmin.value = Boolean(adminId && String(profile?.telegramId) === adminId);
  } catch {
    isAdmin.value = false;
  }
});
</script>

<style>
:root {
  color-scheme: dark;
  --accent: #02c076;
  --surface: #17151f;
  --surface-2: #1a1724;
  --border: #2b2837;
  --transition-fast: 0.15s ease;
  --transition-medium: 0.25s ease;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  font-family: "SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI",
    "Helvetica Neue", Arial, sans-serif;
  font-size: 14px;
  background: #0b0a10;
  color: #f3f3f6;
}
.app {
  min-height: 100vh;
}
.main {
  padding: 22px 20px 110px;
}
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.section-title {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: -0.4px;
  margin: 6px 0 6px;
}
.muted {
  color: #8d8a9b;
  font-size: 12px;
}
.card {
  background: var(--surface);
  border-radius: 24px;
  padding: 16px;
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.25);
  transition: transform var(--transition-medium), box-shadow var(--transition-medium), border-color var(--transition-medium);
  border: 1px solid rgba(255, 255, 255, 0.04);
}
.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.3);
  border-color: rgba(255, 255, 255, 0.08);
}
.card:active {
  transform: translateY(0);
}
.card-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.pill {
  border-radius: 999px;
  padding: 8px 20px;
  border: 1px solid var(--border);
  background: #1b1924;
  font-size: 14px;
  cursor: pointer;
  transition: transform var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast),
    background var(--transition-fast);
}
.pill:hover {
  border-color: rgba(2, 192, 118, 0.5);
  color: #e9f6f1;
}
.pill:active {
  transform: scale(0.98);
}
.pill--active {
  border-color: var(--accent);
  color: var(--accent);
}
.pill--dark {
  background: linear-gradient(135deg, var(--accent) 0%, #8cc7ff 50%, #b77bff 100%);
  color: #0b0a10;
  border-color: transparent;
}
.grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
}
.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border-radius: 18px;
  background: var(--surface-2);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast), border-color var(--transition-fast);
  border: 1px solid transparent;
}
.list-item:hover {
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.25);
  border-color: rgba(255, 255, 255, 0.05);
}
.list-item:active {
  transform: scale(0.99);
}
.list-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.list-right {
  text-align: right;
}
.list-title {
  font-weight: 600;
}
.list-sub {
  font-size: 12px;
  color: #8d8a9b;
}
.list-amount {
  font-weight: 700;
}
.global-faq {
  position: fixed;
  right: 18px;
  bottom: 96px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #1b1825;
  border: 1px solid #2a2636;
  color: #bdb8cc;
  font-weight: 800;
  z-index: 40;
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
.faq-item {
  display: grid;
  gap: 6px;
  padding: 12px;
  background: #17151f;
  border-radius: 12px;
  border: 1px solid #262234;
}
.faq-q {
  font-weight: 700;
}
.faq-a {
  color: #bdb8cc;
  font-size: 13px;
  line-height: 1.4;
}
.token-avatar {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  font-weight: 700;
  color: #0b0a10;
}
.token-avatar.usdt {
  background: var(--accent);
}
.token-avatar.fur {
  background: linear-gradient(135deg, var(--accent) 0%, #b77bff 100%);
}
.button {
  border: none;
  border-radius: 999px;
  padding: 10px 18px;
  font-weight: 600;
  cursor: pointer;
  transition: transform var(--transition-fast), opacity var(--transition-fast), box-shadow var(--transition-fast);
}
.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}
.button:hover {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 10px 20px rgba(2, 192, 118, 0.15);
}
.button:active {
  transform: translateY(0);
}
.button--primary {
  background: linear-gradient(135deg, var(--accent) 0%, #8cc7ff 50%, #b77bff 100%);
  color: #0b0a10;
}
.button--ghost {
  background: #201d2b;
  color: #d8d6e3;
}
.input {
  width: 100%;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: #f3f3f6;
  padding: 12px 14px;
  font-size: 14px;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast);
}
.input:focus {
  outline: none;
}
.input:focus-visible {
  border-color: rgba(2, 192, 118, 0.6);
  box-shadow: 0 0 0 3px rgba(2, 192, 118, 0.18);
  transform: translateY(-1px);
}
.gradient-card {
  background: linear-gradient(160deg, #1b1924 0%, #151320 100%);
}
.bottom-nav {
  position: fixed;
  bottom: 14px;
  left: 14px;
  right: 14px;
  background: #12101a;
  border-radius: 22px;
  padding: 12px 12px;
  display: flex;
  justify-content: space-between;
  gap: 4px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
}
.bottom-nav a {
  text-decoration: none;
  color: #8d8a9b;
  font-size: 13px;
  padding: 6px 6px;
  border-radius: 999px;
  white-space: nowrap;
  transition: color var(--transition-fast), transform var(--transition-fast), background var(--transition-fast);
}
.bottom-nav a:hover {
  color: #cfeee6;
  transform: translateY(-1px);
}
.bottom-nav a:active {
  transform: translateY(0);
}
.nav-item {
  display: flex;
  align-items: center;
  justify-content: center;
}
.nav-icon {
  width: 26px;
  height: 26px;
}
.nav-item--center {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #1a1724;
  color: var(--accent);
  box-shadow: 0 10px 24px rgba(2, 192, 118, 0.25);
}
.nav-item--center .nav-icon {
  width: 28px;
  height: 28px;
}
.bottom-nav a.router-link-active {
  color: var(--accent);
}
.toast {
  position: fixed;
  left: 50%;
  bottom: 110px;
  transform: translateX(-50%);
  background: rgba(18, 16, 26, 0.9);
  color: #f3f3f6;
  border: 1px solid #2a2733;
  padding: 10px 16px;
  border-radius: 999px;
  font-size: 13px;
  backdrop-filter: blur(6px);
  z-index: 60;
  animation: toast-fade 1.8s ease;
}
.faq-item {
  padding: 12px 14px;
  overflow: hidden;
}
.faq-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  border: none;
  background: transparent;
  color: inherit;
  font-size: 14px;
  font-weight: 700;
  text-align: left;
  padding: 0;
}
.faq-toggle span:first-child {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.faq-icon {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #241f2d;
  color: #cfeee6;
  font-size: 16px;
  transition: transform 0.2s ease;
}
.faq-icon.open {
  transform: rotate(45deg);
}
.faq-body {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.4;
}
@keyframes toast-fade {
  0% {
    opacity: 0;
    transform: translate(-50%, 6px);
  }
  15% {
    opacity: 1;
    transform: translate(-50%, 0);
  }
  85% {
    opacity: 1;
    transform: translate(-50%, 0);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -4px);
  }
}
.page-enter-active,
.page-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
.icon-button {
  border: none;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #1a1724;
  color: #c7c3d6;
  cursor: pointer;
  transition: transform var(--transition-fast), background var(--transition-fast);
}
.icon-button:hover {
  background: #232031;
}
.icon-button:active {
  transform: scale(0.96);
}
.actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 12px;
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
  transition: transform var(--transition-fast), background var(--transition-fast);
}
.action-btn:hover {
  transform: translateY(-1px);
  background: #201d2b;
}
.action-btn:active {
  transform: translateY(0);
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
.button-full {
  width: 100%;
  margin-top: 16px;
}
.loading-wrap {
  display: grid;
  place-items: center;
  padding: 18px 0;
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
