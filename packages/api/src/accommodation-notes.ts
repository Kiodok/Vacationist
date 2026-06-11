import { supabase } from './client';
import type { TablesInsert } from './database.types';
import type { AccommodationNote, CreateAccommodationNoteInput, UpdateAccommodationNoteInput } from '@vacationist/types';

export async function getAccommodationNotes(accommodationId: string): Promise<AccommodationNote[]> {
  const { data, error } = await supabase
    .from('accommodation_notes')
    .select('*')
    .eq('accommodation_id', accommodationId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as unknown as AccommodationNote[];
}

export async function createAccommodationNote(
  accommodationId: string,
  input: CreateAccommodationNoteInput,
): Promise<AccommodationNote> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('accommodation_notes')
    .insert({
      accommodation_id: accommodationId,
      created_by: session.user.id,
      content: input.content,
      // trip_id is NOT NULL in the schema but intentionally omitted — the
      // trg_set_accommodation_note_trip_id BEFORE INSERT trigger populates it
      // from the parent accommodation.
    } as TablesInsert<'accommodation_notes'>)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as AccommodationNote;
}

export async function updateAccommodationNote(
  noteId: string,
  input: UpdateAccommodationNoteInput,
): Promise<AccommodationNote> {
  const { data, error } = await supabase
    .from('accommodation_notes')
    .update({ content: input.content })
    .eq('id', noteId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as AccommodationNote;
}

export async function deleteAccommodationNote(noteId: string): Promise<void> {
  const { error } = await supabase
    .from('accommodation_notes')
    .delete()
    .eq('id', noteId);

  if (error) throw error;
}
