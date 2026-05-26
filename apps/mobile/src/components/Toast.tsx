import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore, type ToastType } from '../stores/toastStore';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { colors } from '@vacationist/ui';

// Approximate height of the offline banner text row (paddingTop 6 + icon/text ~20px).
// The safe area portion is already accounted for in the toast bottom calculation below.
const OFFLINE_BANNER_TEXT_HEIGHT = 26;

const TYPE_COLORS: Record<ToastType, { bg: string; text: string }> = {
  success: { bg: 'rgba(62, 207, 142, 0.15)', text: colors.success },
  error: { bg: 'rgba(255, 92, 92, 0.15)', text: colors.danger },
  warning: { bg: 'rgba(245, 166, 35, 0.15)', text: colors.warning },
};

export function ToastContainer() {
  const insets = useSafeAreaInsets();
  const { isConnected } = useNetworkStatus();
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  // Push toasts above the offline banner when it's visible so they never overlap.
  const offlineClearance = isConnected ? 0 : OFFLINE_BANNER_TEXT_HEIGHT + Math.max(insets.bottom, 6);

  return (
    <View style={[styles.container, { bottom: Math.max(insets.bottom, 16) + 8 + offlineClearance }]}>
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
