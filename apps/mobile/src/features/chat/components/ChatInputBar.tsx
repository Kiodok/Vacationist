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
import { useChatDraftStore } from '../../../stores/chatDraftStore';

interface ChatInputBarProps {
  tripId: string;
  onSend: (text: string) => void;
  onSaveEdit: (messageId: string, text: string) => void;
  editingMessage: TripMessageWithSender | null;
  onCancelEdit: () => void;
  isPending: boolean;
}

export function ChatInputBar({
  tripId,
  onSend,
  onSaveEdit,
  editingMessage,
  onCancelEdit,
  isPending,
}: Readonly<ChatInputBarProps>) {
  const { t } = useTranslation('chat');
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const setDraft = useChatDraftStore((s) => s.setDraft);
  const clearDraft = useChatDraftStore((s) => s.clearDraft);
  // Lazy-seeded once from the store, not subscribed — this component fully remounts on every
  // tab switch (see chatDraftStore's doc comment), so a fresh mount reading the last-written
  // draft here is exactly the "restore on return" behavior task 10 asks for, with no extra
  // re-renders from a live store subscription on every keystroke.
  const [text, setText] = useState(() => useChatDraftStore.getState().draftsByTripId[tripId] ?? '');
  const inputRef = useRef<TextInput>(null);
  // Tracks the previously-seen editingMessage id so the effect below can tell "just mounted,
  // never editing" apart from "was editing, now cancelled/saved" — both present as
  // editingMessage === null, but only the latter should clear text. Getting this wrong is
  // exactly what silently wiped the restored draft on every mount before this fix.
  const prevEditingIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.text);
      inputRef.current?.focus();
    } else if (prevEditingIdRef.current !== null) {
      // A real transition out of edit mode (cancel/save) — clear, same as before this fix.
      // On initial mount prevEditingIdRef.current is still null, so this is skipped and the
      // lazy useState initializer's restored draft (if any) survives.
      setText('');
    }
    prevEditingIdRef.current = editingMessage?.id ?? null;
  }, [editingMessage?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const trimmed = text.trim();
  const canSubmit = !!trimmed && !isPending;

  const handleChangeText = (value: string) => {
    setText(value);
    // Editing an existing message is a separate, ephemeral flow — it isn't a "compose" draft
    // and shouldn't overwrite whatever the user was mid-typing before they tapped Edit.
    if (!editingMessage) setDraft(tripId, value);
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (editingMessage) {
      onSaveEdit(editingMessage.id, trimmed);
      onCancelEdit();
    } else {
      onSend(trimmed);
      clearDraft(tripId);
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
    <View
      className="border-t border-border bg-surface"
      style={Platform.OS !== 'ios' ? { borderTopLeftRadius: 20, borderTopRightRadius: 20 } : undefined}
    >
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
            onChangeText={handleChangeText}
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
