import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore, type ToastType } from '../stores/toastStore';
import { colors } from '@vacationist/ui';

const TYPE_COLORS: Record<ToastType, { bg: string; text: string }> = {
  success: { bg: 'rgba(62, 207, 142, 0.15)', text: colors.success },
  error: { bg: 'rgba(255, 92, 92, 0.15)', text: colors.danger },
  warning: { bg: 'rgba(245, 166, 35, 0.15)', text: colors.warning },
};

export function ToastContainer() {
  const insets = useSafeAreaInsets();
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <View style={[styles.container, { bottom: Math.max(insets.bottom, 16) + 8 }]}>
      {toasts.map((toast) => {
        const colors = TYPE_COLORS[toast.type];
        return (
          <Pressable
            key={toast.id}
            style={[styles.toast, { backgroundColor: colors.bg }]}
            onPress={() => removeToast(toast.id)}
          >
            <Text style={[styles.text, { color: colors.text }]}>{toast.message}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
  },
  toast: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
  },
});
