import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { dayjs } from '@vacationist/utils';
import type { Notification } from '@vacationist/types';
import { colors, NOTIFICATION_ICON_COLORS } from '@vacationist/ui';

interface NotificationItemProps {
  notification: Notification;
  onPress: (notification: Notification) => void;
}

export function NotificationItem({ notification, onPress }: NotificationItemProps) {
  const { t } = useTranslation('notifications');
  const typeKey = `type.${notification.type}` as const;
  const iconConfig = NOTIFICATION_ICON_COLORS[notification.type] ?? { icon: 'notifications-outline', color: colors.primary };
  const iconColor = notification.is_read ? colors.textMuted : iconConfig.color;

  return (
    <Pressable
      onPress={() => onPress(notification)}
      className="flex-row items-start gap-md p-md bg-surface border border-border rounded-md"
    >
      <View
        className="mt-xs w-[32px] h-[32px] rounded-full items-center justify-center"
        style={{ backgroundColor: notification.is_read ? 'transparent' : iconConfig.color + '1A' }}
      >
        <Ionicons
          name={iconConfig.icon}
          size={18}
          color={iconColor}
        />
      </View>

      <View className="flex-1 gap-xs">
        <Text
          className={`text-body-default ${notification.is_read ? 'text-text-secondary' : 'text-text-primary font-semibold'}`}
          numberOfLines={2}
        >
          {t(typeKey, { defaultValue: notification.title })}
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
