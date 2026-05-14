import { supabase } from './client';
import type { Activity, ActivityVote, VoteType, CreateActivityInput, UpdateActivityInput } from '@vacationist/types';

export async function getActivities(tripId: string): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('trip_id', tripId)
    .order('activity_date', { ascending: true, nullsFirst: false })
    .order('start_time', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as unknown as Activity[];
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('activities')
    .insert({
      trip_id: tripId,
      title: input.title,
      description: input.description ?? null,
      category: input.category ?? null,
      cost_estimate: input.cost_estimate ?? null,
      activity_date: input.activity_date ?? null,
      start_time: input.start_time ?? null,
      end_time: input.end_time ?? null,
      external_url: input.external_url ?? null,
      maps_url: input.maps_url ?? null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Activity;
}

export async function updateActivity(activityId: string, input: UpdateActivityInput): Promise<Activity> {
  const { data, error } = await supabase
    .from('activities')
    .update(input)
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

export async function castActivityVote(activityId: string, vote: VoteType): Promise<ActivityVote> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('activity_votes')
    .delete()
    .eq('activity_id', activityId)
    .eq('user_id', user.id);

  if (error) throw error;
}
