import { supabase, freshChannel } from './client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  TripMessage,
  TripMessageWithSender,
  TripMessagesPage,
  CreateTripMessageInput,
  UpdateTripMessageInput,
} from '@vacationist/types';

export const MESSAGE_PAGE_SIZE = 50;

const MESSAGE_SELECT = '*, sender:users!created_by(name, avatar_url)';

export async function getTripMessages(
  tripId: string,
  cursor?: string,
): Promise<TripMessagesPage> {
  let query = supabase
    .from('trip_messages')
    .select(MESSAGE_SELECT)
    .eq('trip_id', tripId)
    .is('deleted_at', null);

  // Keyset pagination: stable against realtime prepends, unlike offsets.
  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(MESSAGE_PAGE_SIZE);

  if (error) throw error;
  const items = (data ?? []) as unknown as TripMessageWithSender[];
  return {
    items,
    nextCursor: items.length === MESSAGE_PAGE_SIZE ? items[items.length - 1].created_at : null,
  };
}

export async function createMessage(
  tripId: string,
  input: CreateTripMessageInput,
): Promise<TripMessageWithSender> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('trip_messages')
    .insert({
      trip_id: tripId,
      created_by: session.user.id,
      text: input.text.trim(),
    })
    .select(MESSAGE_SELECT)
    .single();

  if (error) throw error;
  return data as unknown as TripMessageWithSender;
}

export async function updateMessage(
  messageId: string,
  input: UpdateTripMessageInput,
): Promise<TripMessageWithSender> {
  const { data, error } = await supabase
    .from('trip_messages')
    .update({ text: input.text.trim() })
    .eq('id', messageId)
    .select(MESSAGE_SELECT)
    .single();

  if (error) throw error;
  return data as unknown as TripMessageWithSender;
}

export async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_trip_message', { p_message_id: messageId });
  if (error) throw error;
}

export interface MessageRealtimeCallbacks {
  onInsert: (message: TripMessage) => void;
  // Soft deletes arrive as UPDATE with deleted_at set — no DELETE handler needed.
  onUpdate: (message: TripMessage) => void;
}

export function subscribeToMessages(
  tripId: string,
  callbacks: MessageRealtimeCallbacks,
): RealtimeChannel {
  const channel = freshChannel(`trip-messages:${tripId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'trip_messages',
        filter: `trip_id=eq.${tripId}`,
      },
      (payload) => callbacks.onInsert(payload.new as unknown as TripMessage),
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'trip_messages',
        filter: `trip_id=eq.${tripId}`,
      },
      (payload) => callbacks.onUpdate(payload.new as unknown as TripMessage),
    )
    .subscribe();

  return channel;
}

export function unsubscribeFromMessages(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}
