import { memo } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TripMessageWithSender } from '@vacationist/types';
import { colors, useResolvedTheme } from '@vacationist/ui';
import { MemberAvatar } from '../../trips/components/MemberAvatar';
import { formatMessageTimeParts } from '../utils/formatMessageTime';

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
}: Readonly<ChatMessageRowProps>) {
  const { t } = useTranslation('chat');
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
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
          <Text className="text-body-small font-semibold text-text-primary" numberOfLines={1}>
            {senderName}
          </Text>
          <View
            className={`rounded-md px-sm py-xs ${isOwn ? 'bg-primary/15' : 'bg-surface-elevated'}`}
            style={{
              borderWidth: isColorful ? 1 : 0,
              borderColor: colors.border,
              ...(isColorful && Platform.OS === 'web' ? { boxShadow: '0 1px 4px rgba(0,0,0,0.12)' } : {}),
            }}
          >
            <Text className="text-body text-text-primary text-left" selectable>
              {message.text}
            </Text>
            {(() => {
              const { datePart, timePart } = formatMessageTimeParts(message.created_at);
              return (
                <View className="flex-row gap-[4px] items-baseline self-end mt-[2px]">
                  {datePart && (
                    <Text className="text-label text-text-muted">{datePart}</Text>
                  )}
                  <Text className="text-label text-text-muted">{timePart}</Text>
                </View>
              );
            })()}
          </View>
        </View>
      </View>
    </Pressable>
  );
});
