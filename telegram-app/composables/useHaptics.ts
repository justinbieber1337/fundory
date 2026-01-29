export const useHaptics = () => {
  const { $telegram } = useNuxtApp() as any;

  const impact = (style: "light" | "medium" | "heavy" = "light") => {
    $telegram?.HapticFeedback?.impactOccurred?.(style);
  };

  const notification = (type: "success" | "warning" | "error" = "success") => {
    $telegram?.HapticFeedback?.notificationOccurred?.(type);
  };

  return { impact, notification };
};
