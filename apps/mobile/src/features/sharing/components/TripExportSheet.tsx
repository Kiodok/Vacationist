import { useState } from 'react';
import { View, Text, Pressable, Modal, Switch, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, ThemedIcon, useResolvedTheme } from '@vacationist/ui';
import { useTripExport } from '../hooks/useTripExport';

interface TripExportSheetProps {
  visible: boolean;
  onClose: () => void;
  tripId: string;
}

export function TripExportSheet({ visible, onClose, tripId }: TripExportSheetProps) {
  const { t } = useTranslation('sharing');
  const insets = useSafeAreaInsets();
  const theme = useResolvedTheme();
  const { isReady, isExporting, exportTrip } = useTripExport(tripId);
  const [includeExpenses, setIncludeExpenses] = useState(false);

  async function handleExport() {
    const success = await exportTrip(includeExpenses);
    if (success) onClose();
  }

  const isColorful = theme === 'colorful';
  const switchTrackColor = {
    false: colors.border,
    true: isColorful ? colors.surface : colors.primary,
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-background/80" onPress={onClose} />
        <View
          className="bg-surface-elevated rounded-t-lg px-md pt-md"
          style={{ paddingBottom: Math.max(insets.bottom, 32) }}
        >
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          <View className="flex-row items-center gap-sm mb-xs">
            <ThemedIcon name="document-text-outline" size={22} color={colors.primary} />
            <Text className="text-heading-m text-text-primary">{t('export.title')}</Text>
          </View>
          <Text className="text-body-small text-text-secondary mb-lg">{t('export.subtitle')}</Text>

          {/* Include expenses toggle */}
          <View className="flex-row items-center justify-between bg-surface rounded-md px-md py-sm mb-lg">
            <Text className="text-body text-text-primary flex-1 mr-md">{t('export.includeExpenses')}</Text>
            <Switch
              value={includeExpenses}
              onValueChange={setIncludeExpenses}
              trackColor={switchTrackColor}
              thumbColor={isColorful ? colors.surfaceElevated : '#FFFFFF'}
            />
          </View>

          {/* Export button */}
          <Pressable
            onPress={handleExport}
            disabled={!isReady || isExporting}
            className="py-md rounded-md bg-primary items-center"
            style={({ pressed }) => ({ opacity: pressed || !isReady || isExporting ? 0.6 : 1 })}
          >
            {isExporting ? (
              <View className="flex-row items-center gap-sm">
                <ActivityIndicator size="small" color={theme === 'colorful' ? colors.surface : '#FFFFFF'} />
                <Text className="font-semibold text-body" style={{ color: theme === 'colorful' ? colors.surface : '#FFFFFF' }}>{t('export.exporting')}</Text>
              </View>
            ) : (
              <View className="flex-row items-center gap-sm">
                <ThemedIcon name="share-outline" size={18} color={theme === 'colorful' ? colors.surface : '#FFFFFF'} />
                <Text className="font-semibold text-body" style={{ color: theme === 'colorful' ? colors.surface : '#FFFFFF' }}>{t('export.shareButton')}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
