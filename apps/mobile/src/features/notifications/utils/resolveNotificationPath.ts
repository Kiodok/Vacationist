import type { Notification } from '@vacationist/types';

export function resolveNotificationPath(
  notification: Pick<Notification, 'type' | 'trip_id' | 'related_type'> & { related_id?: string | null }
): string | null {
  const { type, trip_id, related_type, related_id } = notification;
  if (!trip_id) return null;

  const highlight = related_id ? `&highlightId=${related_id}` : '';

  switch (type) {
    case 'new_activity':
    case 'schedule_change':
      return `/trip/${trip_id}?tab=Activities${highlight}`;
    case 'vote_finalized':
    case 'vote_update':
      if (related_type === 'accommodation') return `/trip/${trip_id}?tab=Base${highlight}`;
      if (related_type === 'transfer_flight') return `/trip/${trip_id}?tab=Transfer${highlight}`;
      return `/trip/${trip_id}?tab=Activities${highlight}`;
    case 'expense_change':
      return `/trip/${trip_id}?tab=Expenses${highlight}`;
    case 'new_member':
      return `/trip/${trip_id}?tab=Settings`;
    case 'reminder':
      return `/trip/${trip_id}`;
    case 'document_access_request':
      return '/(tabs)/profile';
    case 'lost_found':
      return `/trip/${trip_id}?tab=Stuff${highlight}`;
    case 'shared_packing':
      return `/trip/${trip_id}?tab=Stuff${highlight}`;
    default:
      return `/trip/${trip_id}`;
  }
}
