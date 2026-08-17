import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { i18n } from '@vacationist/i18n';
import type { Notification } from '@vacationist/types';
import { colors, NOTIFICATION_ICON_COLORS , ThemedIcon } from '@vacationist/ui';
import { safeFromNow } from '@vacationist/utils';

// Keep in sync with NOTIFICATION_TRANSLATIONS in supabase/functions/push-notification/index.ts —
// EXCEPT new_chat_message, which deliberately diverges (see its comment below: this file
// always renders a generic body, the edge function decrypts a preview for push only).
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
  review_nudge: {
    en: "Your trip is over — we'd love a quick rating!",
    de: 'Deine Reise ist vorbei — wir freuen uns über eine Bewertung!',
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
  shared_packing_claimed: {
    en: '{{creator}} claimed "{{entity}}" for "{{trip}}".',
    de: '{{creator}} hat "{{entity}}" für "{{trip}}" beansprucht.',
  },
  expense_settlement: {
    en: '{{creator}} settled all expenses in "{{trip}}".',
    de: '{{creator}} hat alle Ausgaben in "{{trip}}" beglichen.',
  },
  activity_reminder: {
    en: '"{{entity}}" in "{{trip}}" starts in 1 hour!',
    de: '"{{entity}}" in "{{trip}}" beginnt in 1 Stunde!',
  },
  // Chat message content is never decrypted into notification rows (context_entity is
  // always null for this type) — trip_messages.text stays encrypted at rest at all
  // times, so this body is intentionally generic. The push notification's lock-screen
  // preview is decrypted on demand instead — see resolveChatPreview() in
  // supabase/functions/push-notification/index.ts. This is a deliberate divergence
  // from that file's NOTIFICATION_TRANSLATIONS['new_chat_message'] template — do not
  // "fix" it back to interpolate {{entity}}.
  new_chat_message: {
    en: '{{creator}} sent a message.',
    de: '{{creator}} hat eine Nachricht gesendet.',
  },
  trip_deleted: {
    en: '{{creator}} deleted "{{trip}}".',
    de: '{{creator}} hat "{{trip}}" gelöscht.',
  },
  // Virtual key: same DB type member_left, context_entity='removed' = organizer kick.
  member_left: {
    en: '{{creator}} left "{{trip}}".',
    de: '{{creator}} hat "{{trip}}" verlassen.',
  },
  member_left_removed: {
    en: '{{creator}} was removed from "{{trip}}".',
    de: '{{creator}} wurde aus "{{trip}}" entfernt.',
  },
};

// Several notification kinds reuse one DB type and are distinguished by the body or
// the English title the DB trigger stores. Mirror of effectiveType in the edge
// function's translateNotification — keep both in sync.
type EffectiveNotificationType =
  | Notification['type']
  | 'shared_packing_self'
  | 'shared_packing_claimed'
  | 'lost_found_found'
  | 'lost_found_lost'
  | 'lost_found_resolved'
  | 'lost_found_reopened'
  | 'activity_reminder'
  | 'review_nudge'
  | 'member_left_removed';

function resolveEffectiveType(notification: Notification): EffectiveNotificationType {
  // i_got_it shared packing notifications reuse type='shared_packing' but their
  // DB body starts with 'For "' — use the dedicated template so we don't claim
  // the person added something "for everyone" when they're bringing it themselves.
  if (notification.type === 'shared_packing') {
    // claimed must be checked before self — both store body starting with 'For "',
    // so the title pattern is the only reliable discriminator.
    if (notification.title?.includes(' claimed: ')) return 'shared_packing_claimed';
    if (notification.body?.startsWith('For "')) return 'shared_packing_self';
  }
  if (notification.type === 'lost_found') {
    switch (notification.title) {
      case 'Item found':     return 'lost_found_found';
      case 'Item lost':      return 'lost_found_lost';
      case 'Case resolved':  return 'lost_found_resolved';
      case 'Case reopened':  return 'lost_found_reopened';
    }
  }
  if (notification.type === 'reminder' && notification.related_type === 'activity_reminder') {
    return 'activity_reminder';
  }
  if (notification.type === 'reminder' && notification.related_type === 'review_nudge') {
    return 'review_nudge';
  }
  if (notification.type === 'member_left' && notification.context_entity === 'removed') {
    return 'member_left_removed';
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

export function NotificationItem({ notification, onPress, onDelete }: Readonly<NotificationItemProps>) {
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
          {t(typeKey, { defaultValue: notification.title, name: notification.context_creator ?? '', trip: notification.context_trip ?? '' })}
        </Text>
        {translatedBody ? (
          <Text className="text-body-small text-text-secondary" numberOfLines={2}>
            {translatedBody}
          </Text>
        ) : null}
        <Text className="text-body-small text-text-muted">
          {safeFromNow(notification.created_at)}
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
