import { useState, useRef } from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedIcon } from '@vacationist/ui';

interface AddIngredientInputProps {
  onAdd: (title: string, quantity: number | null, unit: string | null) => void;
  isPending: boolean;
}

export function AddIngredientInput({ onAdd, isPending }: AddIngredientInputProps) {
  const { t } = useTranslation('recipes');
  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('');
  const titleRef = useRef<TextInput>(null);

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (!trimmed || isPending) return;

    const parsedQty = quantity.trim() ? parseFloat(quantity.trim()) : null;
    const trimmedUnit = unit.trim() || null;

    onAdd(trimmed, parsedQty != null && !isNaN(parsedQty) ? parsedQty : null, trimmedUnit);
    setTitle('');
    setQuantity('1');
    setUnit('');
    titleRef.current?.focus();
  };

  return (
    <View className="px-md py-sm gap-sm border-t border-border bg-surface">
      <View className="flex-row items-center gap-sm">
        <TextInput
          ref={titleRef}
          className="flex-1 bg-surface-elevated border border-border rounded-sm px-md py-sm text-text-primary text-body"
          placeholderTextColor="#5C5C5C"
          placeholder={t('placeholder.ingredientName')}
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={handleSubmit}
          returnKeyType="done"
          maxLength={100}
          blurOnSubmit={false}
        />
        <Pressable
          onPress={handleSubmit}
          disabled={!title.trim() || isPending}
          className={`w-[40px] h-[40px] rounded-sm items-center justify-center ${
            !title.trim() || isPending ? 'bg-surface-elevated' : 'bg-primary'
          }`}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <ThemedIcon
            name="add"
            size={22}
            color={!title.trim() || isPending ? '#5C5C5C' : '#FFFFFF'}
          />
        </Pressable>
      </View>
      <View className="flex-row gap-sm">
        <TextInput
          className="w-[80px] bg-surface-elevated border border-border rounded-sm px-md py-xs text-text-primary text-body-small"
          placeholderTextColor="#5C5C5C"
          placeholder={t('placeholder.quantity')}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="decimal-pad"
          returnKeyType="done"
        />
        <TextInput
          className="w-[80px] bg-surface-elevated border border-border rounded-sm px-md py-xs text-text-primary text-body-small"
          placeholderTextColor="#5C5C5C"
          placeholder={t('placeholder.unit')}
          value={unit}
          onChangeText={setUnit}
          maxLength={50}
          returnKeyType="done"
        />
      </View>
    </View>
  );
}
