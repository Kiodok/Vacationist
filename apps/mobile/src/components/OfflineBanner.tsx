import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { colors } from '@vacationist/ui';

export function OfflineBanner() {
  const { isConnected } = useNetworkStatus();

  if (isConnected) return null;

  return (
    <View
      style={{
        backgroundColor: colors.warning,
        paddingVertical: 6,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        zIndex: 9999,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={14} color="#000" />
      <Text style={{ color: '#000', fontSize: 12, fontWeight: '600' }}>
        You're offline – changes will sync on reconnect
      </Text>
    </View>
  );
}
