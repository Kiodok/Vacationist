import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dayjs } from '@vacationist/utils';
import type { Notification, NotificationType } from '@vacationist/types';
import { colors } from '@vacationist/ui';

function iconForType(type: NotificationType): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'new_activity':     return 'add-circle-outline';
    case 'vote_finalized':
    case 'vote_update':      return 'checkmark-circle-outline';
    case 'expense_change':   return 'wallet-outline';
    case 'new_member':       return 'person-add-outline';
    case 'schedule_change':  return 'calendar-outline';
    case 'reminder':         return 'megaphone-outline';
    case 'document_access_request': return 'document-text-outline';
    default:                 return 'notifications-outline';
  }
}

interface NotificationItemProps {
  notification: Notification;
  onPress: (notification: Notification) => void;
}

export function NotificationItem({ notification, onPress }: NotificationItemProps) {
  return (
    <Pressable
      onPress={() => onPress(notification)}
      className="flex-row items-start gap-md p-md bg-surface border border-border rounded-md"
    >
      <View className="mt-xs">
        <Ionicons
          name={iconForType(notification.type)}
          size={22}
          color={notification.is_read ? colors.textMuted : colors.primary}
        />
      </View>

      <View className="flex-1 gap-xs">
        <Text
          className={`text-body-default ${notification.is_read ? 'text-text-secondary' : 'text-text-primary font-semibold'}`}
          numberOfLines={2}
        >
          {notification.title}
        </Text>
        {notification.body ? (
          <Text className="text-body-small text-text-secondary" numberOfLines={2}>
            {notification.body}
          </Text>
        ) : null}
        <Text className="text-body-small text-text-muted">
          {dayjs(notification.created_at).fromNow()}
        </Text>
      </View>

      {!notification.is_read && (
        <View className="w-2 h-2 rounded-full bg-primary mt-xs" />
      )}
    </Pressable>
  );
}
