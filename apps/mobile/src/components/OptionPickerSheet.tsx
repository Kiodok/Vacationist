import { View, Text, Pressable, Modal, KeyboardAvoidingView, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, ThemedIcon, useResolvedTheme } from '@vacationist/ui';
import type { IoniconsName } from '@vacationist/ui';
import { SwipeToDismiss } from './SwipeToDismiss';
import { SheetScrollArea } from './SheetScrollArea';

export interface OptionPickerOption {
  value: string;
  label: string;
  icon?: IoniconsName;
}

interface OptionPickerSheetProps {
  visible: boolean;
  title: string;
  options: OptionPickerOption[];
  selectedValue: string | null | undefined;
  onSelect: (value: string | null) => void;
  onClose: () => void;
  /** Renders an extra "None" row that clears the selection — for optional fields (e.g. activity category). */
  clearable?: boolean;
}

export function OptionPickerSheet({ visible, title, options, selectedValue, onSelect, onClose, clearable = false }: OptionPickerSheetProps) {
  const insets = useSafeAreaInsets();
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const { t: tCommon } = useTranslation('common');

  const handleSelect = (value: string | null) => {
    onSelect(value);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <SwipeToDismiss
          onDismiss={onClose}
          className="bg-surface-elevated rounded-t-lg px-md pt-md max-h-[85%]"
          style={{ paddingBottom: Math.max(insets.bottom, 32) }}
        >
            <View className="items-center mb-md">
              <View className="w-[36px] h-[4px] rounded-full bg-border" />
            </View>

            <View className="flex-row items-center justify-between mb-sm">
              <Text className="text-heading-m text-text-primary">{title}</Text>
              <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Text className="text-text-secondary text-body">{tCommon('button.cancel')}</Text>
              </Pressable>
            </View>

            <SheetScrollArea>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              <View className="gap-sm">
                {clearable && (
                  <Pressable
                    onPress={() => handleSelect(null)}
                    className="rounded-md border px-md py-sm flex-row items-center justify-between"
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.7 : 1,
                      backgroundColor: selectedValue == null ? `${colors.primary}1A` : colors.surface,
                      borderColor: selectedValue == null ? colors.primary : colors.border,
                      borderWidth: selectedValue == null && isColorful ? 2 : 1,
                    })}
                  >
                    <Text className={`text-body flex-1 ${selectedValue == null ? 'text-primary font-semibold' : 'text-text-secondary'}`}>
                      {tCommon('option.none')}
                    </Text>
                    {selectedValue == null && <ThemedIcon name="checkmark" size={16} color={colors.primary} />}
                  </Pressable>
                )}
                {options.map((option) => {
                  const isSelected = option.value === selectedValue;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => handleSelect(option.value)}
                      className="rounded-md border px-md py-sm flex-row items-center justify-between"
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.7 : 1,
                        backgroundColor: isSelected ? `${colors.primary}1A` : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.border,
                        borderWidth: isSelected && isColorful ? 2 : 1,
                      })}
                    >
                      <View className="flex-1 flex-row items-center gap-sm">
                        {option.icon && (
                          <ThemedIcon name={option.icon} size={18} color={isSelected ? colors.primary : colors.textSecondary} />
                        )}
                        <Text className={`text-body flex-1 ${isSelected ? 'text-primary font-semibold' : 'text-text-primary'}`} numberOfLines={1}>
                          {option.label}
                        </Text>
                      </View>
                      {isSelected && <ThemedIcon name="checkmark" size={16} color={colors.primary} />}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
            </SheetScrollArea>
        </SwipeToDismiss>
      </KeyboardAvoidingView>
    </Modal>
  );
}
