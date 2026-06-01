import { supabase } from './client';
import type {
  PackingCategory,
  PackingItem,
  SharedPackingItem,
  LostFoundCase,
  CreatePackingItemInput,
  UpdatePackingItemInput,
  CreateSharedPackingItemInput,
  UpdateSharedPackingItemInput,
  CreateLostFoundCaseInput,
  UpdateLostFoundCaseInput,
} from '@vacationist/types';

// Tables not yet in generated types — cast through any until next type regeneration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ─── Packing Categories ───────────────────────────────────────────────────────

export async function getPackingCategories(): Promise<PackingCategory[]> {
  const { data, error } = await db
    .from('packing_categories')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PackingCategory[];
}

// ─── Private Packing Items ────────────────────────────────────────────────────

export async function getPackingItems(tripId: string): Promise<PackingItem[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { data, error } = await db
    .from('packing_items')
    .select('*')
    .eq('trip_id', tripId)
    .eq('user_id', session.user.id)
    .is('deleted_at', null)
    .order('is_packed', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as PackingItem[];
}

export async function createPackingItem(tripId: string, input: CreatePackingItemInput): Promise<PackingItem> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { data, error } = await db
    .from('packing_items')
    .insert({
      trip_id: tripId,
      user_id: session.user.id,
      category: input.category,
      title: input.title,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as PackingItem;
}

export async function updatePackingItem(itemId: string, input: UpdatePackingItemInput): Promise<PackingItem> {
  const { data, error } = await db
    .from('packing_items')
    .update(input)
    .eq('id', itemId)
    .select()
    .single();

  if (error) throw error;
  return data as PackingItem;
}

export async function softDeletePackingItem(itemId: string): Promise<void> {
  const { error } = await db.rpc('soft_delete_packing_item', { p_item_id: itemId });
  if (error) throw error;
}

export async function copyPackingListToTrip(sourceTripId: string, targetTripId: string): Promise<number> {
  const { data, error } = await db.rpc('copy_packing_list_to_trip', {
    p_source_trip_id: sourceTripId,
    p_target_trip_id: targetTripId,
  });
  if (error) throw error;
  return (data ?? 0) as number;
}

// ─── Shared Packing Items ─────────────────────────────────────────────────────

export async function getSharedPackingItems(tripId: string): Promise<SharedPackingItem[]> {
  const { data, error } = await db
    .from('shared_packing_items')
    .select('*')
    .eq('trip_id', tripId)
    .is('deleted_at', null)
    .order('is_resolved', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as SharedPackingItem[];
}

export async function createSharedPackingItem(tripId: string, input: CreateSharedPackingItemInput): Promise<SharedPackingItem> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const is_resolved = input.item_type !== 'who_has';

  const { data, error } = await db
    .from('shared_packing_items')
    .insert({
      trip_id: tripId,
      title: input.title,
      item_type: input.item_type,
      notes: input.notes ?? null,
      created_by: session.user.id,
      is_resolved,
    })
    .select()
    .single();

  if (error) throw error;
  return data as SharedPackingItem;
}

export async function updateSharedPackingItem(itemId: string, input: UpdateSharedPackingItemInput): Promise<SharedPackingItem> {
  const { data, error } = await db
    .from('shared_packing_items')
    .update(input)
    .eq('id', itemId)
    .select()
    .single();

  if (error) throw error;
  return data as SharedPackingItem;
}

export async function claimSharedPackingItem(itemId: string): Promise<void> {
  const { error } = await db.rpc('claim_shared_packing_item', { p_item_id: itemId });
  if (error) throw error;
}

export async function unclaimSharedPackingItem(itemId: string): Promise<void> {
  const { error } = await db.rpc('unclaim_shared_packing_item', { p_item_id: itemId });
  if (error) throw error;
}

export async function softDeleteSharedPackingItem(itemId: string): Promise<void> {
  const { error } = await db.rpc('soft_delete_shared_packing_item', { p_item_id: itemId });
  if (error) throw error;
}

// ─── Lost & Found Cases ───────────────────────────────────────────────────────

export async function getLostFoundCases(tripId: string): Promise<LostFoundCase[]> {
  const { data, error } = await db
    .from('lost_found_cases')
    .select('*')
    .eq('trip_id', tripId)
    .order('is_resolved', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as LostFoundCase[];
}

export async function createLostFoundCase(tripId: string, input: CreateLostFoundCaseInput): Promise<LostFoundCase> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { data, error } = await db
    .from('lost_found_cases')
    .insert({
      trip_id: tripId,
      case_type: input.case_type,
      title: input.title,
      description: input.description ?? null,
      created_by: session.user.id,
      target_user: input.target_user ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as LostFoundCase;
}

export async function updateLostFoundCase(caseId: string, input: UpdateLostFoundCaseInput): Promise<LostFoundCase> {
  const { data, error } = await db
    .from('lost_found_cases')
    .update(input)
    .eq('id', caseId)
    .select()
    .single();
  if (error) throw error;
  return data as LostFoundCase;
}

export async function resolveLostFoundCase(caseId: string): Promise<void> {
  const { error } = await db.rpc('resolve_lost_found_case', { p_case_id: caseId });
  if (error) throw error;
}

export async function unresolveLostFoundCase(caseId: string): Promise<void> {
  const { error } = await db.rpc('unresolve_lost_found_case', { p_case_id: caseId });
  if (error) throw error;
}

export async function deleteLostFoundCase(caseId: string): Promise<void> {
  const { error } = await db.rpc('delete_lost_found_case', { p_case_id: caseId });
  if (error) throw error;
}
