export const TRIP_STATUS = ['planning', 'active', 'completed', 'archived'] as const;
export type TripStatus = (typeof TRIP_STATUS)[number];

export const MEMBER_ROLE = ['organizer', 'participant', 'guest'] as const;
export type MemberRole = (typeof MEMBER_ROLE)[number];

export const VOTE_TYPE = ['must_do', 'like', 'open', 'skip', 'group_blocker'] as const;
export type VoteType = (typeof VOTE_TYPE)[number];

export const ACTIVITY_STATUS = ['planned', 'reserved', 'completed', 'skipped'] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUS)[number];

export const ACCOMMODATION_STATUS = ['suggested', 'requested', 'reserved', 'booked', 'completed'] as const;
export type AccommodationStatus = (typeof ACCOMMODATION_STATUS)[number];

export const EXPENSE_RELATED_TYPE = ['accommodation', 'activity', 'transport', 'shopping', 'manual'] as const;
export type ExpenseRelatedType = (typeof EXPENSE_RELATED_TYPE)[number];

export const EXPENSE_SPLIT_METHOD = ['even', 'exact', 'shares', 'cover'] as const;
export type ExpenseSplitMethod = (typeof EXPENSE_SPLIT_METHOD)[number];

export const EXPENSE_SPLIT_STATUS = ['open', 'settled'] as const;
export type ExpenseSplitStatus = (typeof EXPENSE_SPLIT_STATUS)[number];

export const SHOPPING_ITEM_STATUS = ['open', 'bought'] as const;
export type ShoppingItemStatus = (typeof SHOPPING_ITEM_STATUS)[number];

export const CURRENCY = ['EUR', 'CHF'] as const;
export type Currency = (typeof CURRENCY)[number];

export const NOTIFICATION_TYPE = [
  'new_activity',
  'vote_update',
  'expense_change',
  'new_member',
  'schedule_change',
  'reminder',
  'vote_finalized',
  'document_access_request',
  'lost_found',
  'shared_packing',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPE)[number];

export const SHARED_PACKING_ITEM_TYPE = ['i_got_it', 'who_has', 'everyone'] as const;
export type SharedPackingItemType = (typeof SHARED_PACKING_ITEM_TYPE)[number];

export const LOST_FOUND_CASE_TYPE = ['lost_unknown', 'lost_known', 'found_unknown', 'found_owner_known'] as const;
export type LostFoundCaseType = (typeof LOST_FOUND_CASE_TYPE)[number];

export const TRANSFER_FLIGHT_STATUS = ['suggested', 'booked', 'completed'] as const;
export type TransferFlightStatus = (typeof TRANSFER_FLIGHT_STATUS)[number];

export const TRANSFER_DIRECTION = ['outbound', 'return', 'outbound-return'] as const;
export type TransferDirection = (typeof TRANSFER_DIRECTION)[number];

export const DOCUMENT_TYPE = ['passport', 'id_card'] as const;
export type DocumentType = (typeof DOCUMENT_TYPE)[number];

export const ACCESS_REQUEST_DURATION = [15, 30, 60] as const;
export type AccessRequestDuration = (typeof ACCESS_REQUEST_DURATION)[number];

export const SUPPORTED_LOCALES = ['en', 'de'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const SUPPORTED_TIMEZONES = [
  'Europe/Berlin',
  'Europe/London',
  'Europe/Paris',
  'Europe/Rome',
  'Europe/Madrid',
  'Europe/Lisbon',
  'Europe/Amsterdam',
  'Europe/Zurich',
  'Europe/Vienna',
  'Europe/Warsaw',
  'Europe/Prague',
  'Europe/Stockholm',
  'Europe/Helsinki',
  'Europe/Athens',
  'Europe/Bucharest',
  'Europe/Budapest',
  'Europe/Istanbul',
] as const;
export type SupportedTimezone = (typeof SUPPORTED_TIMEZONES)[number];
