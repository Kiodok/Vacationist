import { supabase, freshChannel } from './client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  PreworkTopic,
  PreworkPreferences,
  UpsertPreworkPreferencesInput,
  CreatePreworkTopicInput,
  UpdatePreworkTopicInput,
} from '@vacationist/types';

// ---------------------------------------------------------------------------
// Topics
// ---------------------------------------------------------------------------

// TODO: remove cast after running `supabase gen types` — prework_topics not in generated schema yet
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function getPreworkTopics(tripId: string): Promise<PreworkTopic[]> {
  const { data, error } = await db
    .from('prework_topics')
    .select('*')
    .eq('trip_id', tripId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as PreworkTopic[];
}

export async function createPreworkTopic(
  tripId: string,
  input: CreatePreworkTopicInput
): Promise<PreworkTopic> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { count } = await db
    .from('prework_topics')
    .select('id', { count: 'exact', head: true })
    .eq('trip_id', tripId);

  const { data, error } = await db
    .from('prework_topics')
    .insert({
      trip_id: tripId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      seeded_labels: input.seeded_labels ?? [],
      position: count ?? 0,
      created_by: session.user.id,
    } as never)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as PreworkTopic;
}

export async function updatePreworkTopic(
  topicId: string,
  input: UpdatePreworkTopicInput
): Promise<PreworkTopic> {
  const update: Record<string, unknown> = {};
  if (input.title !== undefined) update.title = input.title.trim();
  if (input.description !== undefined) update.description = input.description?.trim() || null;
  if (input.seeded_labels !== undefined) update.seeded_labels = input.seeded_labels;

  const { data, error } = await db
    .from('prework_topics')
    .update(update)
    .eq('id', topicId)
    .select()
    .single();

  if (error) throw error;
  return data as PreworkTopic;
}

export async function deletePreworkTopic(topicId: string): Promise<void> {
  const { error } = await db.rpc('delete_prework_topic', { p_topic_id: topicId });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Preferences (topic-scoped)
// ---------------------------------------------------------------------------

export async function getTopicPreferences(topicId: string): Promise<PreworkPreferences[]> {
  const { data, error } = await db
    .from('prework_preferences')
    .select('*')
    .eq('topic_id', topicId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data as PreworkPreferences[];
}

export async function getMyTopicPreferences(topicId: string): Promise<PreworkPreferences | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { data, error } = await db
    .from('prework_preferences')
    .select('*')
    .eq('topic_id', topicId)
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (error) throw error;
  return data as PreworkPreferences | null;
}

export async function upsertTopicPreferences(
  topicId: string,
  tripId: string,
  input: UpsertPreworkPreferencesInput
): Promise<PreworkPreferences> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { data, error } = await db
    .from('prework_preferences')
    .upsert(
      {
        topic_id: topicId,
        trip_id: tripId,
        user_id: session.user.id,
        filters: input.filters,
      },
      { onConflict: 'topic_id,user_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data as PreworkPreferences;
}

export async function deleteTopicPreferences(topicId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { error } = await db
    .from('prework_preferences')
    .delete()
    .eq('topic_id', topicId)
    .eq('user_id', session.user.id);

  if (error) throw error;
}

export async function resetTopicPreferences(topicId: string): Promise<void> {
  const { error } = await db.rpc('reset_topic_preferences', { p_topic_id: topicId });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Realtime — Topics
// ---------------------------------------------------------------------------

export interface PreworkTopicRealtimeCallbacks {
  onInsert: (topic: PreworkTopic) => void;
  onUpdate: (topic: PreworkTopic) => void;
  onDelete: (oldTopic: { id: string; trip_id?: string }) => void;
}

export function subscribeToPreworkTopicsRealtime(
  tripId: string,
  callbacks: PreworkTopicRealtimeCallbacks,
  onStatus?: (status: string) => void,
): RealtimeChannel {
  return freshChannel(`prework-topics:${tripId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'prework_topics', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onInsert(payload.new as unknown as PreworkTopic),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'prework_topics', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onUpdate(payload.new as unknown as PreworkTopic),
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'prework_topics' },
      (payload) => callbacks.onDelete(payload.old as { id: string; trip_id?: string }),
    )
    .subscribe((status) => onStatus?.(status));
}

export function unsubscribeFromPreworkTopics(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}

// ---------------------------------------------------------------------------
// Realtime — Preferences
// ---------------------------------------------------------------------------

export interface PreworkRealtimeCallbacks {
  onInsert: (pref: PreworkPreferences) => void;
  onUpdate: (pref: PreworkPreferences) => void;
  onDelete: (oldPref: { id: string; trip_id?: string; topic_id?: string; user_id?: string }) => void;
}

export function subscribeToPreworkRealtime(
  tripId: string,
  callbacks: PreworkRealtimeCallbacks,
  onStatus?: (status: string) => void,
): RealtimeChannel {
  return freshChannel(`prework:${tripId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'prework_preferences', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onInsert(payload.new as unknown as PreworkPreferences),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'prework_preferences', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onUpdate(payload.new as unknown as PreworkPreferences),
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'prework_preferences' },
      (payload) => callbacks.onDelete(payload.old as { id: string; trip_id?: string; topic_id?: string; user_id?: string }),
    )
    .subscribe((status) => onStatus?.(status));
}

export function unsubscribeFromPrework(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}
