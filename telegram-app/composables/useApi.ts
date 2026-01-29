export const useApi = () => {
  const config = useRuntimeConfig();
  const { token, ensureToken, clearToken } = useAuth();
  const cache = useState<Record<string, { ts: number; data: unknown }>>("api-cache", () => ({}));

  const apiFetch = async <T>(path: string, options: any = {}): Promise<T> => {
    await ensureToken();
    const { cacheTtl, noCache, ...fetchOptions } = options || {};
    const method = String(fetchOptions.method || "GET").toUpperCase();
    const isGet = method === "GET";
    const ttl = typeof cacheTtl === "number" ? cacheTtl : 8000;
    const cacheKey = `${token.value || "anon"}:${path}`;
    if (isGet && !noCache) {
      const cached = cache.value[cacheKey];
      if (cached && Date.now() - cached.ts < ttl) {
        return cached.data as T;
      }
    }
    const headers = {
      ...(fetchOptions.headers || {}),
      ...(token.value ? { Authorization: `Bearer ${token.value}` } : {}),
    };
    try {
      const response = await $fetch<T>(`${config.public.apiUrl}${path}`, {
        ...fetchOptions,
        headers,
      });
      if (isGet && !noCache) {
        cache.value[cacheKey] = { ts: Date.now(), data: response };
      } else if (!isGet) {
        cache.value = {};
      }
      return response;
    } catch (err: any) {
      const status = err?.statusCode || err?.response?.status;
      if ((status === 401 || status === 403) && token.value) {
        clearToken();
        const refreshed = await ensureToken();
        if (refreshed && token.value) {
          const response = await $fetch<T>(`${config.public.apiUrl}${path}`, {
            ...fetchOptions,
            headers: {
              ...(fetchOptions.headers || {}),
              Authorization: `Bearer ${token.value}`,
            },
          });
          if (isGet && !noCache) {
            cache.value[cacheKey] = { ts: Date.now(), data: response };
          } else if (!isGet) {
            cache.value = {};
          }
          return response;
        }
      }
      throw err;
    }
  };

  return { apiFetch };
};
