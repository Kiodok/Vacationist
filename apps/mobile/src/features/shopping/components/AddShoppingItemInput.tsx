import { useState, useRef } from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface AddShoppingItemInputProps {
  onAdd: (title: string) => void;
  isPending: boolean;
}

export function AddShoppingItemInput({ onAdd, isPending }: AddShoppingItemInputProps) {
  const { t } = useTranslation('shopping');
  const [title, setTitle] = useState('');
  const inputRef = useRef<TextInput>(null);

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (!trimmed || isPending) return;
    onAdd(trimmed);
    setTitle('');
    inputRef.current?.focus();
  };

  return (
    <View className="flex-row items-center px-md py-sm gap-sm border-t border-border bg-surface">
      <TextInput
        ref={inputRef}
        className="flex-1 bg-surface-elevated border border-border rounded-sm px-md py-sm text-text-primary text-body"
        placeholderTextColor="#5C5C5C"
        placeholder={t('placeholder.item')}
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
        <Ionicons
          name="add"
          size={22}
          color={!title.trim() || isPending ? '#5C5C5C' : '#FFFFFF'}
        />
      </Pressable>
    </View>
  );
}
