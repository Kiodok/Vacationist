import { supabase, freshChannel } from './client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  ShoppingList,
  ShoppingListWithCounts,
  ShoppingItem,
  CreateShoppingListInput,
  UpdateShoppingListInput,
  CreateShoppingItemInput,
  UpdateShoppingItemInput,
} from '@vacationist/types';

export async function getShoppingLists(tripId: string): Promise<ShoppingListWithCounts[]> {
  const { data, error } = await supabase.rpc('get_shopping_lists_with_counts', {
    p_trip_id: tripId,
  });
  if (error) throw error;
  return (data ?? []) as unknown as ShoppingListWithCounts[];
}

export async function createShoppingList(tripId: string, input: CreateShoppingListInput): Promise<ShoppingList> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');
  const user = session.user;

  const { data, error } = await supabase
    .from('shopping_lists')
    .insert({
      trip_id: tripId,
      title: input.title,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as ShoppingList;
}

export async function updateShoppingList(listId: string, input: UpdateShoppingListInput): Promise<ShoppingList> {
  const { data, error } = await supabase
    .from('shopping_lists')
    .update({ title: input.title })
    .eq('id', listId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as ShoppingList;
}

export async function archiveShoppingList(listId: string): Promise<void> {
  const { error } = await supabase
    .from('shopping_lists')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', listId);
  if (error) throw error;
}

export async function unarchiveShoppingList(listId: string): Promise<void> {
  const { error } = await supabase
    .from('shopping_lists')
    .update({ archived_at: null })
    .eq('id', listId);
  if (error) throw error;
}

export async function deleteShoppingList(listId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_shopping_list', { p_list_id: listId });
  if (error) throw error;
}

export async function getShoppingItems(listId: string): Promise<ShoppingItem[]> {
  const { data, error } = await supabase
    .from('shopping_items')
    .select('*')
    .eq('shopping_list_id', listId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as unknown as ShoppingItem[];
}

export async function getAllShoppingItemsForTrip(tripId: string): Promise<(ShoppingItem & { list_title: string })[]> {
  const { data, error } = await supabase
    .from('shopping_items')
    .select('*, shopping_lists!inner(title)')
    .eq('trip_id', tripId)
    .is('deleted_at', null)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;

  return ((data ?? []) as unknown as (ShoppingItem & { shopping_lists: { title: string } })[]).map(
    ({ shopping_lists: sl, ...item }) => ({
      ...item,
      list_title: sl.title,
    }),
  );
}

export async function createShoppingItem(listId: string, input: CreateShoppingItemInput): Promise<ShoppingItem> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');
  const user = session.user;

  const { data, error } = await supabase
    .from('shopping_items')
    .insert({
      shopping_list_id: listId,
      title: input.title,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as ShoppingItem;
}

export async function updateShoppingItem(itemId: string, input: UpdateShoppingItemInput): Promise<ShoppingItem> {
  const { data, error } = await supabase
    .from('shopping_items')
    .update(input)
    .eq('id', itemId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as ShoppingItem;
}

export async function softDeleteShoppingItem(itemId: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_shopping_item', { p_item_id: itemId });
  if (error) throw error;
}

export interface ShoppingRealtimeCallbacks {
  onInsert: (item: ShoppingItem) => void;
  onUpdate: (item: ShoppingItem) => void;
  onDelete: (oldItem: { id: string }) => void;
}

export function subscribeToShoppingItems(
  listId: string,
  callbacks: ShoppingRealtimeCallbacks,
): RealtimeChannel {
  const channel = freshChannel(`shopping-items:${listId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'shopping_items',
        filter: `shopping_list_id=eq.${listId}`,
      },
      (payload) => callbacks.onInsert(payload.new as unknown as ShoppingItem),
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'shopping_items',
        filter: `shopping_list_id=eq.${listId}`,
      },
      (payload) => callbacks.onUpdate(payload.new as unknown as ShoppingItem),
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'shopping_items',
        filter: `shopping_list_id=eq.${listId}`,
      },
      (payload) => callbacks.onDelete(payload.old as { id: string }),
    )
    .subscribe();

  return channel;
}

export function unsubscribeFromShoppingItems(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}

export function subscribeToShoppingSync(
  listId: string,
  onItemsRemoved: (ids: string[]) => void,
): RealtimeChannel {
  return freshChannel(`shopping-sync:${listId}`)
    .on('broadcast', { event: 'items-removed' }, ({ payload }) => {
      onItemsRemoved(payload.ids);
    })
    .subscribe();
}

export async function broadcastShoppingItemsRemoved(
  listId: string,
  itemIds: string[],
): Promise<void> {
  try {
    const channelName = `shopping-sync:${listId}`;
    const payload = { type: 'broadcast' as const, event: 'items-removed', payload: { ids: itemIds } };

    // Reuse the existing subscriber channel if present (from subscribeToShoppingSync)
    const existing = supabase.getChannels().find((c) => c.topic === `realtime:${channelName}`);
    if (existing) {
      await existing.send(payload);
      return;
    }

    // No existing subscriber — create a temporary channel just to broadcast
    const channel = supabase.channel(channelName);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        supabase.removeChannel(channel);
        reject(new Error('timeout'));
      }, 5000);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
    await channel.send(payload);
    supabase.removeChannel(channel);
  } catch {
    // Best-effort — clients will see the change on next refetch
  }
}
