import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { colors } from '@vacationist/ui';

export const OFFLINE_BANNER_HEIGHT = 28;

export function OfflineBanner() {
  const { t } = useTranslation('common');
  const { isConnected } = useNetworkStatus();
  const insets = useSafeAreaInsets();

  // null = status not yet determined → keep banner hidden until we know for sure
  if (isConnected !== false) return null;

  return (
    <View style={[styles.banner, { bottom: insets.bottom }]}>
      <Ionicons name="cloud-offline-outline" size={14} color="#000" />
      <Text style={styles.text}>
        {t('offline.banner')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: OFFLINE_BANNER_HEIGHT,
    backgroundColor: colors.warning,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 9,
  },
  text: {
    color: '#000',
    fontSize: 12,
    fontWeight: '600',
  },
});
