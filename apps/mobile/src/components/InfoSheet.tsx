import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SwipeToDismiss } from './SwipeToDismiss';
import { SheetScrollArea } from './SheetScrollArea';

interface InfoSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  content: string;
}

export function InfoSheet({ visible, onClose, title, content }: InfoSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('common');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SwipeToDismiss
        onDismiss={onClose}
        className="bg-surface-elevated rounded-t-lg px-md pt-md max-h-[85%]"
        style={{ paddingBottom: Math.max(insets.bottom, 32) }}
      >
        <View className="items-center mb-md">
          <View className="w-[36px] h-[4px] rounded-full bg-border" />
        </View>
        <View className="flex-row items-center justify-between mb-md">
          <Text className="text-heading-m text-text-primary">{title}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('button.close')}>
            <Text className="text-body text-text-secondary">{t('button.close')}</Text>
          </Pressable>
        </View>
        <SheetScrollArea>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text className="text-body text-text-secondary">{content}</Text>
          </ScrollView>
        </SheetScrollArea>
      </SwipeToDismiss>
    </Modal>
  );
}
