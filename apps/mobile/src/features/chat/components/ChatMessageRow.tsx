import { memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TripMessageWithSender } from '@vacationist/types';
import { MemberAvatar } from '../../trips/components/MemberAvatar';
import { formatMessageTime } from '../utils/formatMessageTime';

interface ChatMessageRowProps {
  message: TripMessageWithSender;
  isOwn: boolean;
  canDelete: boolean;
  onLongPress: (message: TripMessageWithSender) => void;
}

export const ChatMessageRow = memo(function ChatMessageRow({
  message,
  isOwn,
  canDelete,
  onLongPress,
}: ChatMessageRowProps) {
  const { t } = useTranslation('chat');
  const senderName = message.sender?.name ?? t('unknownSender');
  const hasActions = isOwn || canDelete;

  return (
    <Pressable
      onLongPress={hasActions ? () => onLongPress(message) : undefined}
      delayLongPress={300}
      className={`w-full flex-row px-md py-xs ${isOwn ? 'justify-end' : 'justify-start'}`}
      style={({ pressed }) => ({ opacity: pressed && hasActions ? 0.7 : 1 })}
    >
      <View className={`gap-sm max-w-[85%] ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
        <MemberAvatar
          name={senderName}
          avatarUrl={message.sender?.avatar_url ?? null}
          size="sm"
          colorSeed={message.created_by}
        />
        <View className={`shrink gap-[2px] ${isOwn ? 'items-end' : 'items-start'}`}>
          <View className={`items-baseline gap-sm ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
            <Text className="text-body-small font-semibold text-text-primary" numberOfLines={1}>
              {senderName}
            </Text>
            <Text className="text-label text-text-muted">
              {formatMessageTime(message.created_at)}
            </Text>
          </View>
          <Text
            className={`text-body text-text-primary ${isOwn ? 'text-right' : 'text-left'}`}
            selectable
          >
            {message.text}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});
