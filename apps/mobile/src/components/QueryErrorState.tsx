import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, ThemedIcon } from '@vacationist/ui';

interface QueryErrorStateProps {
  onRetry: () => void;
}

/**
 * A query genuinely failed and there is no cached data to fall back on — mirrors
 * `OfflineEmptyState`'s layout so the two read as siblings, but with an error icon/copy instead of
 * an offline one. Render this on `getQueryDisplayState(...).showError`, ahead of a screen's own
 * "nothing here yet" empty state — those must never be shown for a real failure (v1.39.0 round 3).
 */
export function QueryErrorState({ onRetry }: QueryErrorStateProps) {
  const { t } = useTranslation('common');

  return (
    <View className="flex-1 items-center justify-center px-xl gap-md py-xl">
      <View className="w-[80px] h-[80px] rounded-full bg-danger/10 items-center justify-center">
        <ThemedIcon name="alert-circle-outline" size={36} color={colors.danger} />
      </View>
      <Text className="text-body-small text-text-secondary text-center">
        {t('error.loadFailed')}
      </Text>
      <Pressable
        onPress={onRetry}
        className="flex-row items-center gap-xs px-md py-xs rounded-full bg-danger/10"
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        accessibilityRole="button"
        accessibilityLabel={t('offline.retry')}
      >
        <ThemedIcon name="refresh-outline" size={18} color={colors.danger} />
        <Text className="text-body-small text-danger font-semibold">{t('offline.retry')}</Text>
      </Pressable>
    </View>
  );
}
