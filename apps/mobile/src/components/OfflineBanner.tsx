import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { colors } from '@vacationist/ui';

export const OFFLINE_BANNER_HEIGHT = 28;

export function OfflineBanner() {
  const { t } = useTranslation('common');
  const { isConnected } = useNetworkStatus();

  if (isConnected) return null;

  return (
    <View style={styles.banner}>
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
    bottom: 0,
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
