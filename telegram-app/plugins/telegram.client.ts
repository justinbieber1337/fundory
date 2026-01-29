export default defineNuxtPlugin(() => {
  const telegram = (window as any)?.Telegram?.WebApp;
  return {
    provide: {
      telegram,
    },
  };
});
