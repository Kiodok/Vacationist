import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { RichText } from '@vacationist/ui';
import type { TripNote } from '@vacationist/types';

interface ViewNoteSheetProps {
  visible: boolean;
  note: TripNote;
  onClose: () => void;
}

export function ViewNoteSheet({ visible, note, onClose }: ViewNoteSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('notes');
  const { t: tCommon } = useTranslation('common');
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-background/80" onPress={onClose} />
        <View className="bg-surface-elevated rounded-t-lg px-md pt-md max-h-[85%]" style={{ paddingBottom: Math.max(insets.bottom, 32) }}>
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          <View className="flex-row items-center justify-between mb-md">
            <Text className="text-heading-m text-text-primary">{t('view.title')}</Text>
            <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Text className="text-text-secondary text-body">{tCommon('button.close')}</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="gap-md">
              <RichText className="text-body text-text-primary font-semibold" selectable>
                {note.title}
              </RichText>
              {!!note.description && (
                <RichText className="text-body text-text-secondary" selectable>
                  {note.description}
                </RichText>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
