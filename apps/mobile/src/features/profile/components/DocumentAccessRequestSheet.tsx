import { useState } from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, ThemedIcon, useResolvedTheme } from '@vacationist/ui';

interface DocumentAccessRequestSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (durationMinutes: number) => void;
  isPending: boolean;
}

export function DocumentAccessRequestSheet({
  visible,
  onClose,
  onSubmit,
  isPending,
}: DocumentAccessRequestSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('profile');
  const { t: tCommon } = useTranslation("common");
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const [selected, setSelected] = useState<number>(30);

  const DURATION_OPTIONS = [
    { value: 15, label: t('accessRequest.duration.15min') },
    { value: 30, label: t('accessRequest.duration.30min') },
    { value: 60, label: t('accessRequest.duration.1hour') },
  ] as const;

  const handleSubmit = () => {
    onSubmit(selected);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-background/80" onPress={onClose} />
        <View className="bg-surface-elevated rounded-t-lg px-md pt-md" style={{ paddingBottom: Math.max(insets.bottom, 32) }}>
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          <View className="flex-row items-center justify-between mb-md">
            <Text className="text-heading-m text-text-primary font-semibold">{t('accessRequest.sheetTitle')}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text className="text-body text-text-secondary">{tCommon('button.cancel')}</Text>
            </Pressable>
          </View>

          <View className="bg-surface border border-border rounded-md p-md mb-lg gap-xs">
            <View className="flex-row items-center gap-xs">
              <ThemedIcon name="information-circle-outline" size={16} color={colors.textSecondary} />
              <Text className="text-body-small text-text-secondary font-medium">{t('accessRequest.howItWorks')}</Text>
            </View>
            <Text className="text-body-small text-text-muted">
              {t('accessRequest.howItWorksBody')}
            </Text>
          </View>

          <Text className="text-label text-text-muted uppercase mb-sm">{t('accessRequest.duration.label')}</Text>
          <View className="flex-row gap-sm mb-lg">
            {DURATION_OPTIONS.map(({ value, label }) => (
              <Pressable
                key={value}
                onPress={() => setSelected(value)}
                className={`flex-1 min-h-[48px] rounded-sm border items-center justify-center ${
                  selected === value
                    ? 'bg-primary/20 border-primary'
                    : 'bg-surface border-border'
                }`}
              >
                <Text
                  className={`text-body font-medium ${
                    selected === value ? 'text-primary' : 'text-text-secondary'
                  }`}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={isPending}
            className={`min-h-[48px] rounded-sm items-center justify-center ${
              isPending ? 'bg-primary/50' : 'bg-primary'
            }`}
          >
            {isPending ? (
              <ActivityIndicator size="small" color={isColorful ? colors.surface : '#ffffff'} />
            ) : (
              <Text className="text-body text-white font-semibold" style={isColorful ? { color: colors.surface } : undefined}>{t('accessRequest.send')}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
