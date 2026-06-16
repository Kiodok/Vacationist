import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { i18n } from '@vacationist/i18n';
import { dayjs } from '@vacationist/utils';
import type { Notification } from '@vacationist/types';
import { colors, NOTIFICATION_ICON_COLORS , ThemedIcon } from '@vacationist/ui';

// Keep in sync with NOTIFICATION_TRANSLATIONS in supabase/functions/push-notification/index.ts.
// shared_packing_self is a virtual key used to distinguish i_got_it notifications
// (DB body starts with 'For "') from 'everyone' notifications — they share the same
// DB type but have different semantics. This avoids a DB schema change.
const BODY_TEMPLATES: Record<string, Record<string, string>> = {
  new_activity: {
    en: '{{creator}} added "{{entity}}" to "{{trip}}".',
    de: '{{creator}} hat "{{entity}}" zu "{{trip}}" hinzugefügt.',
  },
  vote_finalized: {
    en: 'Voting is closed for "{{entity}}" in "{{trip}}".',
    de: 'Die Abstimmung zu "{{entity}}" in "{{trip}}" ist abgeschlossen.',
  },
  vote_update: {
    en: 'The group has voted on "{{entity}}".',
    de: 'Die Gruppe hat über "{{entity}}" abgestimmt.',
  },
  expense_change: {
    en: '{{creator}} added "{{entity}}" to "{{trip}}".',
    de: '{{creator}} hat "{{entity}}" zu "{{trip}}" hinzugefügt.',
  },
  new_member: {
    en: '{{creator}} is now part of "{{trip}}".',
    de: '{{creator}} ist jetzt Teil von "{{trip}}".',
  },
  schedule_change: {
    en: '"{{entity}}" in "{{trip}}" has been rescheduled.',
    de: '"{{entity}}" in "{{trip}}" wurde neu geplant.',
  },
  activity_note: {
    en: '{{creator}} added a note to "{{entity}}" in "{{trip}}".',
    de: '{{creator}} hat eine Notiz zu "{{entity}}" in "{{trip}}" hinzugefügt.',
  },
  lost_found: {
    en: '{{creator}} reported "{{entity}}" in "{{trip}}".',
    de: '{{creator}} hat "{{entity}}" in "{{trip}}" gemeldet.',
  },
  // Virtual lost_found keys — same DB type, distinguished by the English title the
  // DB triggers store (see resolveEffectiveType below).
  lost_found_found: {
    en: '{{creator}} thinks you may have: "{{entity}}".',
    de: '{{creator}} denkt, du könntest "{{entity}}" haben.',
  },
  lost_found_lost: {
    en: '{{creator}} thinks you may have: "{{entity}}".',
    de: '{{creator}} denkt, du könntest "{{entity}}" haben.',
  },
  lost_found_resolved: {
    en: '"{{entity}}" has been marked as resolved in "{{trip}}".',
    de: '"{{entity}}" wurde in "{{trip}}" als gelöst markiert.',
  },
  lost_found_reopened: {
    en: '"{{entity}}" has been reopened in "{{trip}}".',
    de: '"{{entity}}" wurde in "{{trip}}" wieder geöffnet.',
  },
  shared_packing: {
    en: '{{creator}} added "{{entity}}" for everyone in "{{trip}}".',
    de: '{{creator}} hat "{{entity}}" für alle in "{{trip}}" hinzugefügt.',
  },
  shared_packing_self: {
    en: '{{creator}} is bringing "{{entity}}" for "{{trip}}".',
    de: '{{creator}} bringt "{{entity}}" für "{{trip}}".',
  },
  expense_settlement: {
    en: '{{creator}} settled all expenses in "{{trip}}".',
    de: '{{creator}} hat alle Ausgaben in "{{trip}}" beglichen.',
  },
};

// Several notification kinds reuse one DB type and are distinguished by the body or
// the English title the DB trigger stores. Mirror of effectiveType in the edge
// function's translateNotification — keep both in sync.
type EffectiveNotificationType =
  | Notification['type']
  | 'shared_packing_self'
  | 'lost_found_found'
  | 'lost_found_lost'
  | 'lost_found_resolved'
  | 'lost_found_reopened';

function resolveEffectiveType(notification: Notification): EffectiveNotificationType {
  // i_got_it shared packing notifications reuse type='shared_packing' but their
  // DB body starts with 'For "' — use the dedicated template so we don't claim
  // the person added something "for everyone" when they're bringing it themselves.
  if (notification.type === 'shared_packing' && notification.body?.startsWith('For "')) {
    return 'shared_packing_self';
  }
  if (notification.type === 'lost_found') {
    switch (notification.title) {
      case 'Item found':     return 'lost_found_found';
      case 'Item lost':      return 'lost_found_lost';
      case 'Case resolved':  return 'lost_found_resolved';
      case 'Case reopened':  return 'lost_found_reopened';
    }
  }
  return notification.type;
}

function translateBody(notification: Notification): string | null {
  const lang = i18n.language?.split('-')[0] ?? 'en';

  const templates = BODY_TEMPLATES[resolveEffectiveType(notification)];
  if (!templates) return notification.body;

  const hasContext = notification.context_entity || notification.context_trip || notification.context_creator;
  if (!hasContext) return notification.body;

  const template = templates[lang] ?? templates['en'];
  if (!template) return notification.body;

  // If the template references {{trip}} but context_trip is null (e.g. a "claimed"
  // shared-packing notification), rendering would produce an empty trip name.
  // Fall back to the raw DB body instead.
  if (template.includes('{{trip}}') && !notification.context_trip) return notification.body;

  return template
    .replaceAll('{{entity}}', notification.context_entity ?? '')
    .replaceAll('{{trip}}', notification.context_trip ?? '')
    .replaceAll('{{creator}}', notification.context_creator ?? '');
}

interface NotificationItemProps {
  notification: Notification;
  onPress: (notification: Notification) => void;
  onDelete?: (notification: Notification) => void;
}

export function NotificationItem({ notification, onPress, onDelete }: NotificationItemProps) {
  const { t } = useTranslation('notifications');
  const typeKey = `type.${resolveEffectiveType(notification)}` as const;
  const translatedBody = translateBody(notification);
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
        <ThemedIcon
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
        {translatedBody ? (
          <Text className="text-body-small text-text-secondary" numberOfLines={2}>
            {translatedBody}
          </Text>
        ) : null}
        <Text className="text-body-small text-text-muted">
          {dayjs(notification.created_at).fromNow()}
        </Text>
      </View>

      <View className="items-center gap-sm">
        {!notification.is_read && (
          <View className="w-2 h-2 rounded-full bg-primary" />
        )}
        {onDelete && (
          <Pressable
            onPress={() => onDelete(notification)}
            hitSlop={8}
            className="p-xs"
          >
            <ThemedIcon name="trash-outline" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}
