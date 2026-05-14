import { supabase } from './client';
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
  const { data, error } = await supabase
    .from('shopping_lists')
    .select('*, shopping_items(id, status)')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return ((data ?? []) as unknown as (ShoppingList & { shopping_items: { id: string; status: string }[] })[]).map(
    ({ shopping_items: items, ...list }) => ({
      ...list,
      item_count: items?.length ?? 0,
      bought_count: items?.filter((i) => i.status === 'bought').length ?? 0,
    }),
  );
}

export async function createShoppingList(tripId: string, input: CreateShoppingListInput): Promise<ShoppingList> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

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

export async function createShoppingItem(listId: string, input: CreateShoppingItemInput): Promise<ShoppingItem> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: maxRow } = await supabase
    .from('shopping_items')
    .select('position')
    .eq('shopping_list_id', listId)
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1)
    .single();

  const nextPosition = (maxRow?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from('shopping_items')
    .insert({
      shopping_list_id: listId,
      title: input.title,
      position: nextPosition,
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
  const uid = Math.random().toString(36).slice(2, 8);
  const channel = supabase
    .channel(`shopping-items:${listId}:${uid}`)
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

export function subscribeToShoppingItemChanges(
  tripId: string,
  onEvent: () => void,
): RealtimeChannel {
  const uid = Math.random().toString(36).slice(2, 8);
  return supabase
    .channel(`shopping-items-overview:${tripId}:${uid}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'shopping_items',
      },
      onEvent,
    )
    .subscribe();
}

export function unsubscribeFromShoppingItems(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}
