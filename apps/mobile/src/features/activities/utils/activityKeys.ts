// Central query-key definitions for the activities feature.
//
// `allActivitiesKey` is a strict *extension* of `activitiesPageKey`
// (['trips', tripId, 'activities', 'all'] vs ['trips', tripId, 'activities']).
// That nesting is deliberate: `invalidateQueries` prefix-matches, so every
// existing invalidation of `activitiesPageKey(tripId)` also refreshes the
// 'all' entry with zero extra call sites. `setQueryData`/`getQueryData` are
// exact-key, so writes to one can never collide with the other.
export const activitiesPageKey = (tripId: string) => ['trips', tripId, 'activities'] as const;
export const allActivitiesKey = (tripId: string) => ['trips', tripId, 'activities', 'all'] as const;
