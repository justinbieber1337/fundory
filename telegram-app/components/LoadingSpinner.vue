<template>
  <div class="spinner loading-spinner" aria-label="Loading"></div>
</template>

<style scoped>
.spinner {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 3px solid rgba(255, 255, 255, 0.16);
  border-top-color: var(--accent);
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
