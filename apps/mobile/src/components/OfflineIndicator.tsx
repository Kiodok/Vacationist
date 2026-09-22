import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, ThemedIcon } from '@vacationist/ui';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

/**
 * A small "you're offline" marker for screen headers — the only persistent offline signal now that
 * the bottom bar is gone. Shows nothing while online, and nothing while the status is still unknown
 * (`null`), so it never flashes on launch.
 *
 * It sits on a `surface` chip with a border rather than tinting the icon `warning`: in the colorful
 * theme the warning amber has almost no contrast against the orange background.
 */
export function OfflineIndicator() {
  const { t } = useTranslation('common');
  const { isConnected } = useNetworkStatus();

  if (isConnected !== false) return null;

  return (
    <View
      accessible
      accessibilityLabel={t('offline.indicator')}
      className="w-[28px] h-[28px] rounded-full bg-surface border border-border items-center justify-center"
    >
      <ThemedIcon name="cloud-offline-outline" size={15} color={colors.textPrimary} />
    </View>
  );
}
