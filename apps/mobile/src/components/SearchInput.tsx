import { View, TextInput, Pressable } from 'react-native';
import { ThemedIcon } from '@vacationist/ui';

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onChangeText, placeholder }: SearchInputProps) {
  return (
    <View className="flex-row items-center bg-surface border border-border rounded-sm px-md gap-sm">
      <ThemedIcon name="search-outline" size={16} color="#5C5C5C" />
      <TextInput
        className="flex-1 py-sm text-text-primary text-body"
        placeholderTextColor="#5C5C5C"
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} hitSlop={8}>
          <ThemedIcon name="close-circle" size={16} color="#5C5C5C" />
        </Pressable>
      )}
    </View>
  );
}
