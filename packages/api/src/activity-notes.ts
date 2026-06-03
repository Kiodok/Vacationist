import { supabase } from './client';
import type { ActivityNote, CreateActivityNoteInput, UpdateActivityNoteInput } from '@vacationist/types';

export async function getActivityNotes(activityId: string): Promise<ActivityNote[]> {
  const { data, error } = await supabase
    .from('activity_notes')
    .select('*')
    .eq('activity_id', activityId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as unknown as ActivityNote[];
}

export async function createActivityNote(
  activityId: string,
  input: CreateActivityNoteInput,
): Promise<ActivityNote> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('activity_notes')
    .insert({
      activity_id: activityId,
      created_by: session.user.id,
      content: input.content,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as ActivityNote;
}

export async function updateActivityNote(
  noteId: string,
  input: UpdateActivityNoteInput,
): Promise<ActivityNote> {
  const { data, error } = await supabase
    .from('activity_notes')
    .update({ content: input.content })
    .eq('id', noteId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as ActivityNote;
}

export async function deleteActivityNote(noteId: string): Promise<void> {
  const { error } = await supabase
    .from('activity_notes')
    .delete()
    .eq('id', noteId);

  if (error) throw error;
}
