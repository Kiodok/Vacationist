import { supabase } from './client';
import type { TripNote, CreateTripNoteInput, UpdateTripNoteInput } from '@vacationist/types';

export async function getNotes(tripId: string): Promise<TripNote[]> {
  const { data, error } = await supabase
    .from('trip_notes')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as unknown as TripNote[];
}

export async function createNote(tripId: string, input: CreateTripNoteInput): Promise<TripNote> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('trip_notes')
    .insert({
      trip_id: tripId,
      created_by: session.user.id,
      title: input.title,
      description: input.description ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TripNote;
}

export async function updateNote(noteId: string, input: UpdateTripNoteInput): Promise<TripNote> {
  const { data, error } = await supabase
    .from('trip_notes')
    .update(input)
    .eq('id', noteId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TripNote;
}

export async function deleteNote(noteId: string): Promise<void> {
  const { error } = await supabase
    .from('trip_notes')
    .delete()
    .eq('id', noteId);

  if (error) throw error;
}
