import type { Notification } from '@vacationist/types';

export function resolveNotificationPath(
  notification: Pick<Notification, 'type' | 'trip_id' | 'related_type'>
): string | null {
  const { type, trip_id, related_type } = notification;
  if (!trip_id) return null;

  switch (type) {
    case 'new_activity':
    case 'schedule_change':
      return `/trip/${trip_id}?tab=Activities`;
    case 'vote_finalized':
    case 'vote_update':
      return related_type === 'accommodation'
        ? `/trip/${trip_id}?tab=Base`
        : `/trip/${trip_id}?tab=Activities`;
    case 'expense_change':
      return `/trip/${trip_id}?tab=Expenses`;
    case 'new_member':
      return `/trip/${trip_id}?tab=Settings`;
    case 'reminder':
      return `/trip/${trip_id}`;
    case 'document_access_request':
      return '/(tabs)/profile';
    case 'lost_found':
    case 'shared_packing':
      return `/trip/${trip_id}?tab=Stuff`;
    default:
      return `/trip/${trip_id}`;
  }
}
