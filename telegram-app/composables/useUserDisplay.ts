import { Ref, computed } from "vue";

type DisplayOptions = {
  fallbackUser?: Ref<any | null>;
  fallbackName?: string | (() => string);
};

export const useUserDisplay = (profile: Ref<any>, options: DisplayOptions = {}) => {
  const fallbackUser = options.fallbackUser;

  const resolveFallbackName = () => {
    if (typeof options.fallbackName === "function") return options.fallbackName();
    return options.fallbackName || "Account";
  };

  const displayName = computed(() => {
    const username = profile.value?.username
      ? `@${profile.value.username}`
      : fallbackUser?.value?.username
        ? `@${fallbackUser.value.username}`
        : null;
    const name =
      username ||
      profile.value?.firstName ||
      fallbackUser?.value?.first_name ||
      profile.value?.telegramId ||
      fallbackUser?.value?.id;
    return name ? String(name) : resolveFallbackName();
  });

  const initials = computed(() => {
    const name = displayName.value;
    return name
      .replace("@", "")
      .split(" ")
      .map((part: string) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  });

  const telegramId = computed(() => profile.value?.telegramId || fallbackUser?.value?.id || "-");

  return {
    displayName,
    initials,
    telegramId,
  };
};
