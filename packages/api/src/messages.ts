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

// Shape returned by get_trip_messages / create_trip_message / update_trip_message RPCs.
// The sender column is a JSON object rather than a joined relation.
interface RpcMessageRow {
  id: string;
  trip_id: string;
  created_by: string;
  text: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sender: { name: string; avatar_url: string | null } | null;
}

function toMessageWithSender(row: RpcMessageRow): TripMessageWithSender {
  return {
    id: row.id,
    trip_id: row.trip_id,
    created_by: row.created_by,
    text: row.text,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    sender: row.sender,
  };
}

export async function getTripMessages(
  tripId: string,
  cursor?: string,
): Promise<TripMessagesPage> {
  const { data, error } = await supabase.rpc('get_trip_messages', {
    p_trip_id: tripId,
    p_cursor: cursor,
    p_limit: MESSAGE_PAGE_SIZE,
  });

  if (error) throw error;
  const items = ((data ?? []) as unknown as RpcMessageRow[]).map(toMessageWithSender);
  return {
    items,
    nextCursor: items.length === MESSAGE_PAGE_SIZE ? items[items.length - 1].created_at : null,
  };
}

export async function createMessage(
  tripId: string,
  input: CreateTripMessageInput,
): Promise<TripMessageWithSender> {
  const { data, error } = await supabase.rpc('create_trip_message', {
    p_trip_id: tripId,
    p_text: input.text.trim(),
  });

  if (error) throw error;
  const rows = (data ?? []) as unknown as RpcMessageRow[];
  if (!rows.length) throw new Error('create_trip_message returned no rows');
  return toMessageWithSender(rows[0]);
}

export async function updateMessage(
  messageId: string,
  input: UpdateTripMessageInput,
): Promise<TripMessageWithSender> {
  const { data, error } = await supabase.rpc('update_trip_message', {
    p_message_id: messageId,
    p_text: input.text.trim(),
  });

  if (error) throw error;
  const rows = (data ?? []) as unknown as RpcMessageRow[];
  if (!rows.length) throw new Error('update_trip_message returned no rows');
  return toMessageWithSender(rows[0]);
}

export async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_trip_message', { p_message_id: messageId });
  if (error) throw error;
}

// Fetches and decrypts a single message by id.
// Used by the realtime handler: INSERT/UPDATE payloads contain encrypted BYTEA,
// so we re-fetch via RPC to get the plaintext before hydrating the cache.
export async function getMessageById(messageId: string): Promise<TripMessageWithSender | null> {
  const { data, error } = await supabase.rpc('get_trip_message_by_id', {
    p_message_id: messageId,
  });
  if (error) throw error;
  const rows = (data ?? []) as unknown as RpcMessageRow[];
  return rows.length ? toMessageWithSender(rows[0]) : null;
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
