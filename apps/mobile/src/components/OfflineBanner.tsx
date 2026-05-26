import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { colors } from '@vacationist/ui';

export function OfflineBanner() {
  const { isConnected } = useNetworkStatus();
  const insets = useSafeAreaInsets();

  if (isConnected) return null;

  return (
    <View style={[styles.banner, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      <Ionicons name="cloud-offline-outline" size={14} color="#000" />
      <Text style={styles.text}>
        You're offline – changes will sync on reconnect
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.warning,
    paddingTop: 6,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 9999,
  },
  text: {
    color: '#000',
    fontSize: 12,
    fontWeight: '600',
  },
});
