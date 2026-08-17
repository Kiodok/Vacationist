import type { Notification } from '@vacationist/types';

export function resolveNotificationPath(
  notification: Pick<Notification, 'type' | 'trip_id' | 'related_type'> & { related_id?: string | null }
): string | null {
  const { type, trip_id, related_type, related_id } = notification;

  // review_nudge is handled before this function is called (see
  // openStoreReviewOrFallback) — it opens the native review sheet rather
  // than navigating, so it has no path of its own here.

  // trip_deleted routes to home regardless of trip_id — the trip no longer exists
  if (type === 'trip_deleted') return '/(tabs)';

  if (!trip_id) return null;

  const highlight = related_id ? `&highlightId=${related_id}` : '';

  switch (type) {
    case 'new_activity':
    case 'schedule_change':
    case 'activity_note':
      return `/trip/${trip_id}?tab=Activities${highlight}`;
    case 'vote_finalized':
    case 'vote_update':
      if (related_type === 'accommodation') return `/trip/${trip_id}?tab=Base${highlight}`;
      if (related_type === 'transfer_flight') return `/trip/${trip_id}?tab=Transfer${highlight}`;
      return `/trip/${trip_id}?tab=Activities${highlight}`;
    case 'expense_change':
      return `/trip/${trip_id}?tab=Expenses${highlight}`;
    case 'expense_settlement':
      return related_id
        ? `/trip/${trip_id}/settlement-receipt?receiptId=${related_id}`
        : `/trip/${trip_id}?tab=Expenses`;
    case 'new_member':
    case 'member_left':
      return `/trip/${trip_id}?tab=Settings`;
    case 'reminder':
      if (related_type === 'expense_reminder') return `/trip/${trip_id}?tab=Expenses`;
      if (related_type === 'activity_reminder') return `/trip/${trip_id}?tab=Activities${highlight}`;
      return `/trip/${trip_id}`;
    case 'document_access_request':
      return '/(tabs)/profile';
    case 'lost_found':
      return `/trip/${trip_id}?tab=Stuff${highlight}`;
    case 'shared_packing':
      return `/trip/${trip_id}?tab=Stuff&stuffSegment=shared${related_id ? `&sharedItemId=${related_id}` : ''}`;
    case 'new_chat_message':
      return `/trip/${trip_id}?tab=Chat`;
    default:
      return `/trip/${trip_id}`;
  }
}
