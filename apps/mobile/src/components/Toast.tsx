import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore, type ToastType } from '../stores/toastStore';
import { colors, useThemeColors } from '@vacationist/ui';

const TYPE_COLORS: Record<ToastType, { bg: string; text: string }> = {
  success: { bg: 'rgba(62, 207, 142, 0.15)', text: colors.success },
  error: { bg: 'rgba(255, 92, 92, 0.15)', text: colors.danger },
  warning: { bg: 'rgba(245, 166, 35, 0.15)', text: colors.warning },
};

export function ToastContainer() {
  const insets = useSafeAreaInsets();
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);
  const tc = useThemeColors();

  if (toasts.length === 0) return null;

  // Raise the toast above the FAB (56px height + 16px bottom margin = 72px zone).
  // Add 12px extra gap so the toast never visually touches the FAB.
  const fabClearance = 72 + 12;
  return (
    <View style={[styles.container, { bottom: Math.max(insets.bottom, fabClearance) + 8 }]}>
      {toasts.map((toast) => {
        const toastColors = TYPE_COLORS[toast.type];
        return (
          // Opaque surface + a coloured border, with the type tint laid over it. The tint alone is only 15 %
          // opaque, so the toast read as see-through and vanished whenever it sat over a matching background.
          <Pressable
            key={toast.id}
            style={[styles.toast, { backgroundColor: tc.surfaceElevated, borderColor: toastColors.text }]}
            onPress={() => removeToast(toast.id)}
          >
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: toastColors.bg, borderRadius: 11 }]} />
            <Text style={[styles.text, { color: toastColors.text }]}>{toast.message}</Text>
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
    borderWidth: 1,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
  },
});
