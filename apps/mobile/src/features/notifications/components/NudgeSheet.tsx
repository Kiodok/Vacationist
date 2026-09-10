import { useState } from 'react';
import { View, Text, Pressable, Modal, FlatList, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from "react-i18next";
import { i18n as i18nInstance } from "@vacationist/i18n";
import { NUDGE_KEYS } from '@vacationist/types';
import { useSendNudge } from '../hooks/useSendNudge';
import { colors, ThemedIcon, useResolvedTheme } from '@vacationist/ui';
import { SwipeToDismiss } from '../../../components/SwipeToDismiss';
import { SheetScrollArea } from '../../../components/SheetScrollArea';

interface NudgeSheetProps {
  tripId: string;
  tripName: string;
  visible: boolean;
  onClose: () => void;
}

export function NudgeSheet({ tripId, tripName, visible, onClose }: Readonly<NudgeSheetProps>) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('notifications');
  const { t: tCommon } = useTranslation('common');
  const { mutate: sendNudge, isPending } = useSendNudge(tripId);
  const isColorful = useResolvedTheme() === 'colorful';
  // Alert.alert is a documented no-op on react-native-web, so an inline per-row confirm is used
  // instead — same pattern as ExpenseDocumentsSection / TicketsSection. Without this the sheet
  // opened on web but tapping a nudge did nothing.
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const label = (key: string, part: 'title' | 'body') =>
    (i18nInstance.t as (k: string, opts?: object) => string)(`notifications:nudge.${key}.${part}`, { tripName });

  const handleSend = (key: string) => {
    sendNudge(
      { title: label(key, 'title'), body: label(key, 'body') },
      { onSuccess: onClose },
    );
    setPendingKey(null);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SwipeToDismiss
        onDismiss={onClose}
        className="bg-surface rounded-t-2xl"
        style={{ maxHeight: '70%' }}
      >
          <View className="items-center pt-sm pb-xs">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>
          <View className="flex-row items-center justify-between px-lg pt-xs pb-md border-b border-border">
            <Text className="text-heading-m text-text-primary">{t('nudge.sheetTitle')}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <ThemedIcon name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <SheetScrollArea>
          <FlatList
            data={NUDGE_KEYS}
            keyExtractor={(key) => key}
            contentContainerStyle={{ padding: 12, gap: 8 }}
            renderItem={({ item: key }) => {
              if (pendingKey === key) {
                return (
                  <View
                    className="bg-background border border-border rounded-md p-md gap-md"
                    style={isColorful ? { boxShadow: '0 1px 4px rgba(0,0,0,0.12)' } : undefined}
                  >
                    <Text className="text-body-small text-text-secondary">{t('nudge.confirmBody')}</Text>
                    <View className="flex-row justify-end gap-sm">
                      <Pressable
                        onPress={() => setPendingKey(null)}
                        disabled={isPending}
                        className="px-md py-sm rounded-sm bg-surface active:opacity-70"
                      >
                        <Text className="text-body-small text-text-secondary">{tCommon('button.cancel')}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleSend(key)}
                        disabled={isPending}
                        className="px-md py-sm rounded-sm bg-primary active:opacity-70 flex-row items-center gap-xs"
                      >
                        {isPending && <ActivityIndicator size="small" color={isColorful ? colors.surface : '#FFFFFF'} />}
                        <Text
                          className="text-body-small font-semibold"
                          style={{ color: isColorful ? colors.surface : '#FFFFFF' }}
                        >
                          {t('nudge.confirmSend')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              }

              return (
                <Pressable
                  onPress={() => setPendingKey(key)}
                  disabled={isPending}
                  className="bg-background border border-border rounded-md p-md gap-xs active:opacity-70"
                >
                  <Text className="text-body-default font-semibold text-text-primary">{label(key, 'title')}</Text>
                  <Text className="text-body-small text-text-secondary">{label(key, 'body')}</Text>
                </Pressable>
              );
            }}
          />
          </SheetScrollArea>
          <View style={{ height: Math.max(insets.bottom, 32) }} />
      </SwipeToDismiss>
    </Modal>
  );
}
