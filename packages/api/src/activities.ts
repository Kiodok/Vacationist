import { supabase, freshChannel } from './client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Activity, ActivityVote, VoteType, CreateActivityInput, UpdateActivityInput } from '@vacationist/types';

export const ACTIVITY_PAGE_SIZE = 50;

export interface ActivitiesPage {
  items: Activity[];
  hasMore: boolean;
}

/**
 * Paged feed for the activities tab. Ordered created_at DESC (NOT NULL, so
 * .range() page boundaries are stable — activity_date/start_time are
 * nullable and would make offsets wobble between pages if used here), with
 * id as a deterministic tiebreaker. This means server order is NOT display
 * order: display order is re-derived client-side (see
 * compareActivitiesForDisplay), and this ordering also guarantees a newly
 * created activity always lands on page 0. Whole-trip consumers (calendar,
 * export, highlights, search) use getAllActivities instead, never this.
 */
export async function getActivitiesPage(
  tripId: string,
  offset = 0,
): Promise<ActivitiesPage> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('trip_id', tripId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + ACTIVITY_PAGE_SIZE - 1);

  if (error) throw error;
  const items = (data as unknown as Activity[]) ?? [];
  return { items, hasMore: items.length === ACTIVITY_PAGE_SIZE };
}

const ALL_ACTIVITIES_BATCH_SIZE = 500;
// Hard ceiling on internal batches (10,000 activities) purely as a runaway
// guard — this loop is not a substitute for real pagination on the caller
// side, it exists so whole-trip consumers (calendar, export, highlights,
// search) never silently see a truncated list the way the old flat
// `.limit(200)` did.
const ALL_ACTIVITIES_MAX_BATCHES = 20;

/**
 * Every non-deleted activity for a trip, in display order (activity_date ASC
 * nulls-last, start_time ASC nulls-last, created_at DESC), fetched via
 * internal batching so no row is silently dropped by a client- or
 * server-side row cap. Whole-trip consumers — calendar grouping, markdown
 * export, highlight selection, full-list search — use this; the paged
 * activities-tab feed (getActivitiesPage) is a separate, smaller fetch.
 */
export async function getAllActivities(tripId: string): Promise<Activity[]> {
  const all: Activity[] = [];
  for (let i = 0; i < ALL_ACTIVITIES_MAX_BATCHES; i++) {
    const offset = i * ALL_ACTIVITIES_BATCH_SIZE;
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('trip_id', tripId)
      .is('deleted_at', null)
      .order('activity_date', { ascending: true, nullsFirst: false })
      .order('start_time', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + ALL_ACTIVITIES_BATCH_SIZE - 1);

    if (error) throw error;
    const batch = (data as unknown as Activity[]) ?? [];
    all.push(...batch);
    if (batch.length < ALL_ACTIVITIES_BATCH_SIZE) break;
  }
  return all;
}

export async function getActivity(activityId: string): Promise<Activity> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('id', activityId)
    .single();

  if (error) throw error;
  return data as unknown as Activity;
}

export async function createActivity(tripId: string, input: CreateActivityInput): Promise<Activity> {
  const { data: activityId, error } = await supabase.rpc('create_activity', {
    p_trip_id: tripId,
    p_title: input.title,
    p_description: input.description ?? undefined,
    p_category: input.category ?? undefined,
    p_cost_estimate: input.cost_estimate ?? undefined,
    p_activity_date: input.activity_date ?? undefined,
    p_start_time: input.start_time ?? undefined,
    p_end_time: input.end_time ?? undefined,
    p_external_url: input.external_url ?? undefined,
    p_maps_url: input.maps_url ?? undefined,
    p_reservation_required: input.reservation_required ?? false,
    p_auto_close: input.auto_close ?? false,
  });

  if (error) throw error;
  if (!activityId) throw new Error('Activity creation returned no ID');
  return getActivity(activityId as string);
}

export async function updateActivity(activityId: string, input: UpdateActivityInput): Promise<Activity> {
  const { data, error } = await supabase
    .from('activities')
    // TODO: remove cast after running `supabase gen types` — auto_close not in generated schema yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(input as any)
    .eq('id', activityId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Activity;
}

export async function softDeleteActivity(activityId: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_activity', { p_activity_id: activityId });
  if (error) throw error;
}

export async function closeActivityVoting(activityId: string): Promise<void> {
  const { error } = await supabase.rpc('close_activity_voting', { p_activity_id: activityId });
  if (error) throw error;
}

export async function reopenActivityVoting(activityId: string): Promise<void> {
  const { error } = await supabase.rpc('reopen_activity_voting', { p_activity_id: activityId });
  if (error) throw error;
}

export async function getActivityVotes(activityId: string): Promise<ActivityVote[]> {
  const { data, error } = await supabase
    .from('activity_votes')
    .select('*')
    .eq('activity_id', activityId);

  if (error) throw error;
  return data as unknown as ActivityVote[];
}

// Trip-scoped (not activity-id-list-scoped): the query key this backs is
// ['trips', tripId, 'activity-votes'] — stable per trip, so paging or adding
// activities never mints a new cache key or triggers a full refetch, unlike
// the old id-list-keyed batch query it replaces.
export async function getTripActivityVotes(tripId: string): Promise<ActivityVote[]> {
  const { data, error } = await supabase
    .from('activity_votes')
    .select('*')
    .eq('trip_id', tripId);

  if (error) throw error;
  return data as unknown as ActivityVote[];
}

// Cross-trip variant for the global (all-trips) calendar screen, keyed by the
// user's trip id list — small and stable (bounded by trip membership count),
// not by activity count.
export async function getActivityVotesForTrips(tripIds: string[]): Promise<ActivityVote[]> {
  if (tripIds.length === 0) return [];

  const { data, error } = await supabase
    .from('activity_votes')
    .select('*')
    .in('trip_id', tripIds);

  if (error) throw error;
  return data as unknown as ActivityVote[];
}

export async function castActivityVote(activityId: string, vote: VoteType): Promise<ActivityVote> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');
  const user = session.user;

  const { data, error } = await supabase
    .from('activity_votes')
    .upsert(
      { activity_id: activityId, user_id: user.id, vote },
      { onConflict: 'activity_id,user_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data as unknown as ActivityVote;
}

export async function removeActivityVote(activityId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');
  const user = session.user;

  const { error } = await supabase
    .from('activity_votes')
    .delete()
    .eq('activity_id', activityId)
    .eq('user_id', user.id);

  if (error) throw error;
}

export interface ActivityVotingRealtimeCallbacks {
  onVoteInsert: (vote: ActivityVote) => void;
  onVoteUpdate: (vote: ActivityVote) => void;
  onVoteDelete: (oldVote: ActivityVote) => void;
  onActivityUpdate: (activity: Activity) => void;
}

export function subscribeToActivityVotingRealtime(
  tripId: string,
  callbacks: ActivityVotingRealtimeCallbacks,
  onStatus?: (status: string) => void,
): RealtimeChannel {
  return freshChannel(`activity-voting:${tripId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'activity_votes', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onVoteInsert(payload.new as unknown as ActivityVote),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'activity_votes', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onVoteUpdate(payload.new as unknown as ActivityVote),
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'activity_votes', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onVoteDelete(payload.old as unknown as ActivityVote),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'activities', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onActivityUpdate(payload.new as unknown as Activity),
    )
    .subscribe((status) => onStatus?.(status));
}

export function unsubscribeFromActivityVoting(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}

export async function getActivitiesForTrips(tripIds: string[]): Promise<Activity[]> {
  if (tripIds.length === 0) return [];

  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .in('trip_id', tripIds)
    .is('deleted_at', null)
    .not('activity_date', 'is', null)
    .order('activity_date', { ascending: true, nullsFirst: false })
    .order('start_time', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as unknown as Activity[];
}

export interface CalendarActivityRealtimeCallbacks {
  onActivityInsert: (activity: Activity) => void;
  onActivityUpdate: (activity: Activity) => void;
  onActivityDelete: (oldActivity: { id: string; trip_id: string }) => void;
}

export function subscribeToCalendarActivitiesRealtime(
  tripId: string,
  callbacks: CalendarActivityRealtimeCallbacks,
  onStatus?: (status: string) => void,
): RealtimeChannel {
  return freshChannel(`calendar-activities:${tripId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'activities', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onActivityInsert(payload.new as unknown as Activity),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'activities', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onActivityUpdate(payload.new as unknown as Activity),
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'activities', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onActivityDelete(payload.old as unknown as { id: string; trip_id: string }),
    )
    .subscribe((status) => onStatus?.(status));
}

export function unsubscribeFromCalendarActivities(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}
