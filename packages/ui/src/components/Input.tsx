import { useState } from 'react';
import { TextInput, View, Text, type TextInputProps } from 'react-native';

interface InputProps extends Omit<TextInputProps, 'className'> {
  label?: string;
  error?: string;
  className?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? 'border-danger'
    : focused
      ? 'border-primary'
      : 'border-border';

  return (
    <View className={`gap-sm ${className}`}>
      {label && (
        <Text className="text-label text-text-secondary uppercase">{label}</Text>
      )}
      <TextInput
        className={`min-h-[48px] rounded-sm bg-surface border ${borderColor} px-md text-body text-text-primary`}
        placeholderTextColor="#5C5C5C"
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        {...props}
      />
      {!!error && <Text className="text-body-small text-danger">{error}</Text>}
    </View>
  );
}
