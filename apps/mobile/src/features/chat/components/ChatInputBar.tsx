import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Platform,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, ThemedIcon, useResolvedTheme } from '@vacationist/ui';
import type { TripMessageWithSender } from '@vacationist/types';

interface ChatInputBarProps {
  onSend: (text: string) => void;
  onSaveEdit: (messageId: string, text: string) => void;
  editingMessage: TripMessageWithSender | null;
  onCancelEdit: () => void;
  isPending: boolean;
}

export function ChatInputBar({
  onSend,
  onSaveEdit,
  editingMessage,
  onCancelEdit,
  isPending,
}: Readonly<ChatInputBarProps>) {
  const { t } = useTranslation('chat');
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.text);
      inputRef.current?.focus();
    } else {
      setText('');
    }
  }, [editingMessage?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const trimmed = text.trim();
  const canSubmit = !!trimmed && !isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (editingMessage) {
      onSaveEdit(editingMessage.id, trimmed);
      onCancelEdit();
    } else {
      onSend(trimmed);
    }
    setText('');
    inputRef.current?.focus();
  };

  // Web: Enter sends, Shift+Enter inserts a newline. On native the return
  // key stays a newline and sending happens via the send button.
  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (Platform.OS !== 'web') return;
    // react-native-web passes the DOM KeyboardEvent as nativeEvent.
    const { key, shiftKey } = e.nativeEvent as TextInputKeyPressEventData & { shiftKey?: boolean };
    if (key === 'Enter' && !shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <View className="border-t border-border bg-surface">
      {editingMessage && (
        <View className="flex-row items-center justify-between px-md pt-sm gap-sm">
          <Text className="text-label text-text-muted flex-1" numberOfLines={1}>
            {t('editing')}
          </Text>
          <Pressable
            onPress={onCancelEdit}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <ThemedIcon name="close" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      )}
      <View
        className="flex-row items-end px-md py-sm gap-sm"
        style={Platform.OS === 'web' ? { alignItems: 'stretch' } : undefined}
      >
        {/* Wrapper owns background/border/radius — more reliable than styling the textarea directly on web */}
        <View
          className="flex-1 bg-surface-elevated border border-border rounded-md overflow-hidden"
          style={{ minHeight: 40, maxHeight: 100 }}
        >
          <TextInput
            ref={inputRef}
            className="px-md py-sm text-text-primary text-body"
            placeholderTextColor="#5C5C5C"
            placeholder={t('placeholder.message')}
            value={text}
            onChangeText={setText}
            onKeyPress={handleKeyPress}
            maxLength={2000}
            multiline
            style={{ minHeight: 40, backgroundColor: 'transparent' }}
          />
        </View>
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          className={`w-[40px] min-h-[40px] rounded-md items-center justify-center ${
            canSubmit ? 'bg-primary' : 'bg-surface-elevated'
          }`}
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <ThemedIcon
            name={editingMessage ? 'checkmark' : 'send'}
            size={20}
            color={!canSubmit ? '#5C5C5C' : isColorful ? colors.surface : '#FFFFFF'}
          />
        </Pressable>
      </View>
    </View>
  );
}
