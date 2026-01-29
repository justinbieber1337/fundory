export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: false },
  vue: {
    config: {
      devtools: false,
      performance: false,
    },
  },
  define: {
    __VUE_PROD_DEVTOOLS__: false,
    "process.env.NODE_ENV": "production",
  },
  router: {
    options: {
      devtools: false,
    },
  },
  experimental: {
    appManifest: false,
  },
  compatibilityDate: "2026-01-25",
  app: {
    head: {
      script: [{ src: "https://telegram.org/js/telegram-web-app.js", defer: true }],
    },
    buildAssetsDir: "/nuxt/",
  },
  vite: {
    server: {
      allowedHosts: ["app.fundory.cc", "api.fundory.cc", "localhost", "127.0.0.1"],
    },
  },
  runtimeConfig: {
    public: {
      apiUrl: process.env.NUXT_PUBLIC_API_URL || "https://api.fundory.cc",
      adminTelegramId: process.env.NUXT_PUBLIC_ADMIN_TELEGRAM_ID || "",
    },
  },
  nitro: {
    routeRules: {
      "/_nuxt/**": {
        headers: {
          "Cache-Control": "no-store",
        },
        redirect: "/nuxt/**",
      },
      "/nuxt/**": {
        headers: {
          "Cache-Control": "no-store",
        },
      },
      "/**": {
        headers: {
          "Cache-Control": "no-store",
          "X-Frame-Options": "ALLOWALL",
          "Content-Security-Policy":
            "frame-ancestors 'self' https://t.me https://*.t.me https://web.telegram.org https://webk.telegram.org;",
        },
      },
    },
  },
});
