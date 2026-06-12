import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '@vacationist/ui';

interface OfflineEmptyStateProps {
  onRetry: () => void;
}

export function OfflineEmptyState({ onRetry }: OfflineEmptyStateProps) {
  const { t } = useTranslation('common');

  return (
    <View className="flex-1 items-center justify-center px-xl gap-md py-xl">
      <View className="w-[80px] h-[80px] rounded-full bg-primary-muted items-center justify-center">
        <Ionicons name="cloud-offline-outline" size={36} color={colors.primary} />
      </View>
      <Text className="text-body-small text-text-secondary text-center">
        {t('offline.noData')}
      </Text>
      <Pressable
        onPress={onRetry}
        className="flex-row items-center gap-xs px-md py-xs rounded-full bg-primary-muted"
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        accessibilityRole="button"
        accessibilityLabel={t('offline.retry')}
      >
        <Ionicons name="refresh-outline" size={18} color={colors.primary} />
        <Text className="text-body-small text-primary font-semibold">{t('offline.retry')}</Text>
      </Pressable>
    </View>
  );
}
