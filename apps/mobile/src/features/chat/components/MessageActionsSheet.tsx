import { useState, useEffect } from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, ThemedIcon } from '@vacationist/ui';
import type { TripMessageWithSender } from '@vacationist/types';

interface MessageActionsSheetProps {
  message: TripMessageWithSender | null;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  isDeletePending: boolean;
}

export function MessageActionsSheet({
  message,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onClose,
  isDeletePending,
}: Readonly<MessageActionsSheetProps>) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('chat');
  const { t: tCommon } = useTranslation('common');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const visible = !!message;

  useEffect(() => {
    if (!visible) setConfirmDelete(false);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-background/80" onPress={onClose} />
        <View
          className="bg-surface-elevated rounded-t-lg px-md pt-md gap-sm"
          style={{ paddingBottom: Math.max(insets.bottom, 32) }}
        >
          <View className="items-center mb-xs">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          {message && (
            <Text className="text-body-small text-text-muted" numberOfLines={2}>
              {message.text}
            </Text>
          )}

          {canEdit && (
            <Pressable
              onPress={onEdit}
              className="flex-row items-center gap-sm py-sm"
              style={({ pressed }) => ({ minHeight: 44, opacity: pressed ? 0.7 : 1 })}
            >
              <ThemedIcon name="create-outline" size={20} color={colors.textPrimary} />
              <Text className="text-body text-text-primary">{t('action.edit')}</Text>
            </Pressable>
          )}

          {canDelete && !confirmDelete && (
            <Pressable
              onPress={() => setConfirmDelete(true)}
              className="flex-row items-center gap-sm py-sm"
              style={({ pressed }) => ({ minHeight: 44, opacity: pressed ? 0.7 : 1 })}
            >
              <ThemedIcon name="trash-outline" size={20} color={colors.danger} />
              <Text className="text-body text-danger">{t('action.delete')}</Text>
            </Pressable>
          )}

          {canDelete && confirmDelete && (
            <View className="rounded-md border border-danger p-md gap-sm">
              <Text className="text-body-small text-text-secondary text-center">
                {t('confirm.delete')}
              </Text>
              <View className="flex-row gap-sm">
                <Pressable
                  onPress={() => setConfirmDelete(false)}
                  className="flex-1 min-h-[44px] rounded-md border border-border items-center justify-center"
                  disabled={isDeletePending}
                >
                  <Text className="text-body text-text-secondary">{tCommon('button.cancel')}</Text>
                </Pressable>
                <Pressable
                  onPress={onDelete}
                  className="flex-1 min-h-[44px] rounded-md bg-danger items-center justify-center"
                  disabled={isDeletePending}
                >
                  {isDeletePending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-body text-white font-semibold">
                      {t('confirm.deleteYes')}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}

          <Pressable
            onPress={onClose}
            className="items-center py-sm"
            style={({ pressed }) => ({ minHeight: 44, opacity: pressed ? 0.7 : 1 })}
          >
            <Text className="text-body text-text-secondary">{tCommon('button.cancel')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
