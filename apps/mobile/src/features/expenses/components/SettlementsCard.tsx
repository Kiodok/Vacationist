import { View, Text, Pressable, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MemberBalance } from '@vacationist/types';
import { isNegligible } from '@vacationist/utils';
import { colors, ThemedIcon, useResolvedTheme } from '@vacationist/ui';

interface SettlementsCardProps {
  balances: MemberBalance[];
  onPress: () => void;
}

export function SettlementsCard({ balances, onPress }: SettlementsCardProps) {
  const { t } = useTranslation('expenses');
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const debtors = balances.filter((b) => !isNegligible(b.net_balance) && b.net_balance < 0);
  const allSettled = debtors.length === 0;

  return (
    <Pressable
      onPress={onPress}
      className="bg-surface rounded-md p-md mb-sm"
      style={({ pressed }) => ({
        opacity: pressed ? 0.85 : 1,
        borderWidth: isColorful ? 2 : 1,
        borderColor: colors.border,
        ...(Platform.OS === 'web' ? { borderStyle: 'solid' as const } : {}),
        ...(isColorful && Platform.OS === 'web' ? { boxShadow: '0 1px 4px rgba(0,0,0,0.12)' } : {}),
      })}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-sm">
          <View className={`w-[36px] h-[36px] rounded-full items-center justify-center ${allSettled ? 'bg-success/15' : 'bg-primary/15'}`}>
            <ThemedIcon
              name={allSettled ? 'checkmark-done' : 'swap-horizontal'}
              size={20}
              color={allSettled ? colors.success : colors.primary}
            />
          </View>
          <View>
            <Text className="text-body text-text-primary font-semibold">{t('summary.title')}</Text>
            <Text className="text-body-small text-text-secondary">
              {allSettled
                ? t('summary.allSettled')
                : t('summary.unsettled', { count: debtors.length })}
            </Text>
          </View>
        </View>
        <ThemedIcon name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}
