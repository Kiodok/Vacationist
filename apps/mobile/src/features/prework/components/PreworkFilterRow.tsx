import { View, Text, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@vacationist/ui';

interface PreworkFilterRowProps {
  label: string;
  weight: number;
  onChangeLabel: (label: string) => void;
  onChangeWeight: (weight: number) => void;
  onRemove: () => void;
  hasError?: boolean;
}

export function PreworkFilterRow({ label, weight, onChangeLabel, onChangeWeight, onRemove, hasError }: PreworkFilterRowProps) {
  const handleWeightChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned === '') {
      onChangeWeight(0);
      return;
    }
    const num = Math.min(parseInt(cleaned, 10), 100);
    onChangeWeight(num);
  };

  return (
    <View className={`flex-row items-center gap-sm bg-surface rounded-md px-md py-sm border ${hasError ? 'border-danger' : 'border-border'}`}>
      <TextInput
        value={label}
        onChangeText={onChangeLabel}
        maxLength={100}
        className="flex-1 text-body text-text-primary bg-surface-elevated rounded-sm px-xs py-xs border border-border"
      />
      <View className="flex-row items-center gap-xs">
        <TextInput
          value={weight === 0 ? '' : String(weight)}
          onChangeText={handleWeightChange}
          keyboardType="numeric"
          maxLength={3}
          placeholder="0"
          placeholderTextColor="#5C5C5C"
          selectTextOnFocus
          className="w-[48px] text-center text-body text-text-primary bg-surface-elevated rounded-sm px-xs py-xs border border-border"
        />
      </View>
      <Pressable onPress={onRemove} hitSlop={8} className="p-xs">
        <Ionicons name="close-circle-outline" size={20} color={colors.danger} />
      </Pressable>
    </View>
  );
}
