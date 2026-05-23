import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Single client reused across all invocations — created once on cold start.
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

interface SingleNotificationPayload {
  batch?: false;
  notification_id: string;
  trip_id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  related_type: string | null;
  related_id: string | null;
}

interface BatchNotificationPayload {
  batch: true;
  trip_id: string;
  type: string;
  title: string;
  body: string | null;
  related_type: string | null;
  related_id: string | null;
  notification_ids: string[];
  user_ids: string[];
}

type NotificationPayload = SingleNotificationPayload | BatchNotificationPayload;

type TokenRow = { user_id: string; push_token: string };
type PrefRow = { user_id: string } & Record<string, unknown>;

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string;
  channelId?: string;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

// Returns null for always-on notification types (no preference gate).
function preferenceColumn(type: string): string | null {
  switch (type) {
    case 'new_activity':    return 'new_activity';
    case 'vote_finalized':
    case 'vote_update':     return 'vote_update';
    case 'expense_change':  return 'expense_change';
    case 'new_member':      return 'new_member';
    case 'schedule_change': return 'schedule_change';
    case 'reminder':        return 'reminder';
    default:                return null;
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function sendToExpo(
  messages: ExpoPushMessage[],
  tokens: string[],
): Promise<{ sent: number; staleTokens: string[] }> {
  const expoResponse = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    },
    body: JSON.stringify(messages),
  });

  if (!expoResponse.ok) {
    console.error('[push] expo http error:', expoResponse.status, await expoResponse.text());
    return { sent: 0, staleTokens: [] };
  }

  const { data: tickets }: { data: ExpoPushTicket[] } = await expoResponse.json();

  const staleTokens: string[] = [];
  tickets.forEach((ticket, idx) => {
    if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
      staleTokens.push(tokens[idx]);
    }
  });

  return { sent: tickets.filter((t) => t.status === 'ok').length, staleTokens };
}

async function handleSingle(payload: SingleNotificationPayload): Promise<Response> {
  const prefCol = preferenceColumn(payload.type);
  if (prefCol !== null) {
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select(prefCol)
      .eq('user_id', payload.user_id)
      .eq('trip_id', payload.trip_id)
      .single();

    if (prefs && prefs[prefCol] === false) {
      return jsonResponse({ sent: 0, reason: 'preference_off' });
    }
  }

  const { data: tokens } = await supabase
    .from('user_push_tokens')
    .select('push_token')
    .eq('user_id', payload.user_id);

  if (!tokens || tokens.length === 0) {
    return jsonResponse({ sent: 0, reason: 'no_tokens' });
  }

  const rawTokens = (tokens as TokenRow[]).map((t) => t.push_token);
  const messages: ExpoPushMessage[] = rawTokens.map((token) => ({
    to: token,
    title: payload.title,
    body: payload.body ?? '',
    sound: 'default',
    channelId: 'default',
    data: {
      notificationId: payload.notification_id,
      tripId: payload.trip_id,
      type: payload.type,
      relatedType: payload.related_type,
      relatedId: payload.related_id,
    },
  }));

  const { sent, staleTokens } = await sendToExpo(messages, rawTokens);

  if (staleTokens.length > 0) {
    await supabase
      .from('user_push_tokens')
      .delete()
      .eq('user_id', payload.user_id)
      .in('push_token', staleTokens);
  }

  if (sent > 0) {
    await supabase
      .from('notifications')
      .update({ push_sent_at: new Date().toISOString() })
      .eq('id', payload.notification_id);
  }

  return jsonResponse({ sent });
}

async function handleBatch(payload: BatchNotificationPayload): Promise<Response> {
  const { trip_id, type, title, body, related_type, related_id, notification_ids, user_ids } = payload;

  if (user_ids.length === 0) return jsonResponse({ sent: 0, reason: 'no_recipients' });

  // Filter by notification preferences in one batch query.
  let eligibleUserIds = user_ids;
  const prefCol = preferenceColumn(type);
  if (prefCol !== null) {
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select(`user_id, ${prefCol}`)
      .in('user_id', user_ids)
      .eq('trip_id', trip_id);

    const disabledSet = new Set(
      (prefs as PrefRow[] ?? []).filter((p) => p[prefCol] === false).map((p) => p.user_id),
    );
    eligibleUserIds = user_ids.filter((uid) => !disabledSet.has(uid));
  }

  if (eligibleUserIds.length === 0) return jsonResponse({ sent: 0, reason: 'all_preferences_off' });

  // Fetch tokens for all eligible users in one query.
  const { data: allTokens } = await supabase
    .from('user_push_tokens')
    .select('user_id, push_token')
    .in('user_id', eligibleUserIds);

  if (!allTokens || allTokens.length === 0) return jsonResponse({ sent: 0, reason: 'no_tokens' });

  // user_ids[i] and notification_ids[i] are positionally aligned.
  const userToNotificationId = new Map(user_ids.map((uid, i) => [uid, notification_ids[i]]));

  const typedTokens = allTokens as TokenRow[];
  const rawTokens = typedTokens.map((t) => t.push_token);
  const messages: ExpoPushMessage[] = typedTokens.map(({ push_token, user_id }, idx) => ({
    to: rawTokens[idx],
    title,
    body: body ?? '',
    sound: 'default',
    channelId: 'default',
    data: {
      notificationId: userToNotificationId.get(user_id as string),
      tripId: trip_id,
      type,
      relatedType: related_type,
      relatedId: related_id,
    },
  }));

  const { sent, staleTokens } = await sendToExpo(messages, rawTokens);

  if (staleTokens.length > 0) {
    await supabase.from('user_push_tokens').delete().in('push_token', staleTokens);
  }

  // Mark push_sent_at on all notification rows for users whose token was not stale.
  const staleSet = new Set(staleTokens);
  const successfulNotificationIds = typedTokens
    .filter((t) => !staleSet.has(t.push_token))
    .map((t) => userToNotificationId.get(t.user_id))
    .filter((id): id is string => !!id);

  if (successfulNotificationIds.length > 0) {
    await supabase
      .from('notifications')
      .update({ push_sent_at: new Date().toISOString() })
      .in('id', successfulNotificationIds);
  }

  return jsonResponse({ sent });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!authHeader || !serviceRoleKey || authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: NotificationPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  if (payload.batch === true) {
    return handleBatch(payload as BatchNotificationPayload);
  }
  return handleSingle(payload as SingleNotificationPayload);
});
