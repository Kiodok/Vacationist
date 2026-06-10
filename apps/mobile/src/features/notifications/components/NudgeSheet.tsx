import { View, Text, Pressable, Modal, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from "react-i18next";
import { i18n as i18nInstance } from "@vacationist/i18n";
import { NUDGE_KEYS } from '@vacationist/types';
import { useSendNudge } from '../hooks/useSendNudge';
import { colors } from '@vacationist/ui';

interface NudgeSheetProps {
  tripId: string;
  tripName: string;
  visible: boolean;
  onClose: () => void;
}

export function NudgeSheet({ tripId, tripName, visible, onClose }: NudgeSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('notifications');
  const { t: tCommon } = useTranslation('common');
  const { mutate: sendNudge, isPending } = useSendNudge(tripId);

  const handleSelect = (key: string) => {
    const title = (i18nInstance.t as (k: string, opts?: object) => string)(`notifications:nudge.${key}.title`, { tripName });
    const body = (i18nInstance.t as (k: string, opts?: object) => string)(`notifications:nudge.${key}.body`, { tripName });
    Alert.alert(
      t('nudge.confirmTitle'),
      t('nudge.confirmBody'),
      [
        { text: tCommon('button.cancel'), style: 'cancel' },
        {
          text: t('nudge.confirmSend'),
          onPress: () => sendNudge({ title, body }, { onSuccess: onClose }),
        },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-surface rounded-t-2xl" style={{ maxHeight: '70%' }}>
          <View className="flex-row items-center justify-between px-lg pt-lg pb-md border-b border-border">
            <Text className="text-heading-s text-text-primary">{t('nudge.sheetTitle')}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <FlatList
            data={NUDGE_KEYS}
            keyExtractor={(key) => key}
            contentContainerStyle={{ padding: 12, gap: 8 }}
            renderItem={({ item: key }) => (
              <Pressable
                onPress={() => handleSelect(key)}
                disabled={isPending}
                className="bg-background border border-border rounded-md p-md gap-xs active:opacity-70"
              >
                <Text className="text-body-default font-semibold text-text-primary">{(i18nInstance.t as (k: string, opts?: object) => string)(`notifications:nudge.${key}.title`, { tripName })}</Text>
                <Text className="text-body-small text-text-secondary">{(i18nInstance.t as (k: string, opts?: object) => string)(`notifications:nudge.${key}.body`, { tripName })}</Text>
              </Pressable>
            )}
            ListFooterComponent={
              isPending ? (
                <View className="items-center py-md">
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : null
            }
          />
          <View style={{ height: Math.max(insets.bottom, 32) }} />
        </View>
      </View>
    </Modal>
  );
}
