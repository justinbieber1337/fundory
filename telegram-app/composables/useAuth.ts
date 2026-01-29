export const useAuth = () => {
  const token = useState<string | null>("auth-token", () => null);
  const config = useRuntimeConfig();
  const { $telegram } = useNuxtApp() as any;
  let authPromise: Promise<string | null> | null = null;

  const loadToken = () => {
    if (process.client) {
      token.value = localStorage.getItem("authToken");
    }
  };

  const saveToken = (value: string) => {
    token.value = value;
    if (process.client) {
      localStorage.setItem("authToken", value);
    }
  };

  const clearToken = () => {
    token.value = null;
    if (process.client) {
      localStorage.removeItem("authToken");
    }
  };

  const getInitUserId = () => {
    if (!process.client) return null;
    const initData = $telegram?.initData || "";
    if (!initData) return null;
    const params = new URLSearchParams(initData);
    const userRaw = params.get("user");
    if (!userRaw) return null;
    try {
      const user = JSON.parse(userRaw);
      return user?.id ? String(user.id) : null;
    } catch {
      return null;
    }
  };

  const getStartParam = () => {
    if (!process.client) return null;
    const initData = $telegram?.initData || "";
    if (!initData) return null;
    const params = new URLSearchParams(initData);
    const value = params.get("start_param");
    if (value) return String(value);
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const urlValue =
      searchParams.get("tgWebAppStartParam") ||
      hashParams.get("tgWebAppStartParam") ||
      searchParams.get("startapp") ||
      hashParams.get("startapp") ||
      searchParams.get("start_param") ||
      hashParams.get("start_param") ||
      searchParams.get("start") ||
      hashParams.get("start");
    return urlValue ? String(urlValue) : null;
  };

  const getTokenTelegramId = (jwt: string) => {
    try {
      const payload = jwt.split(".")[1];
      if (!payload) return null;
      const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized.padEnd(normalized.length + (4 - (normalized.length % 4)) % 4, "=");
      const data = JSON.parse(atob(padded));
      return data?.telegramId ? String(data.telegramId) : null;
    } catch {
      return null;
    }
  };

  const ensureToken = async () => {
    loadToken();
    if (!process.client) return null;

    const initData = $telegram?.initData || "";
    if (!initData) return token.value;

    const initUserId = getInitUserId();
    const startParam = getStartParam();
    const hasRefParam = Boolean(startParam && startParam.startsWith("ref_"));
    const refKey = initUserId ? `ref_applied:${initUserId}` : "ref_applied:unknown";
    const lastApplied = localStorage.getItem(refKey);
    const shouldSyncRef = Boolean(hasRefParam && startParam !== lastApplied);

    if (token.value) {
      const tokenTelegramId = getTokenTelegramId(token.value);
      if (initUserId && tokenTelegramId && initUserId !== tokenTelegramId) {
        clearToken();
      } else if (!shouldSyncRef) {
        return token.value;
      }
    }

    try {
      if (!authPromise) {
        authPromise = $fetch<{ token?: string; user?: any }>(
          `${config.public.apiUrl}/auth/telegram-webapp`,
          {
            method: "POST",
            body: { initData, startParam },
          },
        )
          .then((response) => {
            if (response?.token) {
              saveToken(response.token);
              if (hasRefParam && response?.user?.referrerId) {
                localStorage.setItem(refKey, startParam as string);
              }
              return response.token;
            }
            return null;
          })
          .catch(() => null)
          .finally(() => {
            authPromise = null;
          });
      }
      const tokenValue = await authPromise;
      return tokenValue;
    } catch {
      return null;
    }
    return null;
  };

  return { token, loadToken, saveToken, clearToken, ensureToken };
};
