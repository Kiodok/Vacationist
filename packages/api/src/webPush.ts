import { supabase } from './client';
import type { WebPushSubscriptionInput } from '@vacationist/types';

/** v1.34.0 item 1 — Phase 12: Web Push Notifications. Both RPCs are SECURITY DEFINER — see
 * 20260905120000_create_web_push_subscriptions.sql; direct table writes are denied by RLS. */
export async function upsertWebPushSubscription(input: WebPushSubscriptionInput): Promise<void> {
  const { error } = await supabase.rpc('upsert_web_push_subscription', {
    p_endpoint: input.endpoint,
    p_p256dh_key: input.p256dhKey,
    p_auth_key: input.authKey,
    p_user_agent: input.userAgent,
  });
  if (error) throw error;
}

export async function deleteWebPushSubscription(endpoint: string): Promise<void> {
  const { error } = await supabase.rpc('delete_web_push_subscription', { p_endpoint: endpoint });
  if (error) throw error;
}
