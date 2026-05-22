import { supabase } from './client';
import type { InviteToken, CreateInviteInput, InviteExpiry } from '@vacationist/types';

function getExpiresAt(expiresIn: InviteExpiry): string {
  const now = new Date();
  const ms: Record<InviteExpiry, number> = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
  };
  return new Date(now.getTime() + ms[expiresIn]).toISOString();
}

export async function createInviteToken(
  tripId: string,
  input: CreateInviteInput
): Promise<InviteToken> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');
  const user = session.user;

  const token = crypto.randomUUID();

  const { data, error } = await supabase
    .from('invite_tokens')
    .insert({
      trip_id: tripId,
      token,
      created_by: user.id,
      expires_at: getExpiresAt(input.expires_in),
      max_uses: input.max_uses ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as InviteToken;
}

export async function getActiveInvites(tripId: string): Promise<InviteToken[]> {
  const { data, error } = await supabase
    .from('invite_tokens')
    .select('*')
    .eq('trip_id', tripId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as unknown as InviteToken[];
}

export async function revokeInvite(tokenId: string): Promise<void> {
  const { error } = await supabase
    .from('invite_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId);

  if (error) throw error;
}

export async function redeemInviteToken(tokenValue: string): Promise<string> {
  const { data, error } = await supabase.rpc('redeem_invite_token', {
    token_value: tokenValue,
  });

  if (error) throw error;
  return data as string;
}
