import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';

interface InfoSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  content: string;
}

export function InfoSheet({ visible, onClose, title, content }: InfoSheetProps) {
  const { t } = useTranslation('common');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-background/80" onPress={onClose} />
        <View className="bg-surface-elevated rounded-t-lg px-md pt-md pb-xl max-h-[85%]">
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>
          <View className="flex-row items-center justify-between mb-md">
            <Text className="text-heading-m text-text-primary">{title}</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('button.close')}>
              <Text className="text-body text-text-secondary">{t('button.close')}</Text>
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text className="text-body text-text-secondary">{content}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
