<template>
  <section class="page">
    <div class="section-title">{{ t("faq.title") }}</div>
    <div class="list">
      <div v-for="(item, idx) in faqItems" :key="item.title" class="card faq-item">
        <button class="faq-toggle" @click="toggle(idx)">
          <span>{{ t(item.title) }}</span>
          <span class="faq-icon" :class="{ open: openIndex === idx }">+</span>
        </button>
        <div v-if="openIndex === idx" class="muted faq-body">
          {{ t(item.body) }}
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const { t } = useI18n();
const openIndex = ref<number | null>(null);
const faqItems = useFaqItems();

const toggle = (idx: number) => {
  openIndex.value = openIndex.value === idx ? null : idx;
};
</script>

<style scoped>
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
</style>
