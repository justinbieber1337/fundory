export const useToast = () => {
  const toast = useState<{ message: string; visible: boolean }>("toast", () => ({
    message: "",
    visible: false,
  }));

  const showToast = (message: string, duration = 1800) => {
    toast.value = { message, visible: true };
    setTimeout(() => {
      toast.value = { message: "", visible: false };
    }, duration);
  };

  return { toast, showToast };
};
