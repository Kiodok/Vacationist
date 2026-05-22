import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface NotificationPayload {
  notification_id: string;
  trip_id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  related_type: string | null;
  related_id: string | null;
}

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

// Maps notification type to notification_preferences column name
function preferenceColumn(type: string): string | null {
  switch (type) {
    case 'new_activity':      return 'new_activity';
    case 'vote_finalized':
    case 'vote_update':       return 'vote_update';
    case 'expense_change':    return 'expense_change';
    case 'new_member':        return 'new_member';
    case 'schedule_change':   return 'schedule_change';
    case 'reminder':          return 'reminder';
    case 'document_access_request': return null; // always on
    default:                  return null;
  }
}

Deno.serve(async (req: Request) => {
  // Only POST allowed
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Validate shared secret (set via `supabase secrets set PUSH_NOTIFICATION_SECRET`)
  const authHeader = req.headers.get('Authorization');
  const sharedSecret = Deno.env.get('PUSH_NOTIFICATION_SECRET');
  if (!authHeader || !sharedSecret || authHeader !== `Bearer ${sharedSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: NotificationPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  // Check notification preferences (unless type is always-on)
  const prefCol = preferenceColumn(payload.type);
  if (prefCol !== null) {
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select(prefCol)
      .eq('user_id', payload.user_id)
      .eq('trip_id', payload.trip_id)
      .single();

    if (prefs && prefs[prefCol] === false) {
      return new Response(JSON.stringify({ sent: 0, reason: 'preference_off' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // Fetch push tokens for the user
  const { data: tokens } = await supabase
    .from('user_push_tokens')
    .select('push_token')
    .eq('user_id', payload.user_id);

  if (!tokens || tokens.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no_tokens' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Build Expo push messages
  const messages: ExpoPushMessage[] = tokens.map(({ push_token }) => ({
    to: push_token,
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

  // Send to Expo Push API
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
    const errBody = await expoResponse.text();
    console.error('[push] expo http error:', expoResponse.status, errBody);
    return new Response(JSON.stringify({ sent: 0, reason: 'expo_error' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const expoBody = await expoResponse.json();
  const { data: tickets }: { data: ExpoPushTicket[] } = expoBody;

  // Clean up stale tokens (DeviceNotRegistered)
  const staleTokens: string[] = [];
  tickets.forEach((ticket, idx) => {
    if (
      ticket.status === 'error' &&
      ticket.details?.error === 'DeviceNotRegistered'
    ) {
      staleTokens.push(tokens[idx].push_token);
    }
  });

  if (staleTokens.length > 0) {
    await supabase
      .from('user_push_tokens')
      .delete()
      .eq('user_id', payload.user_id)
      .in('push_token', staleTokens);
  }

  // Mark push_sent_at on the notification row
  const sentCount = tickets.filter((t) => t.status === 'ok').length;
  if (sentCount > 0) {
    await supabase
      .from('notifications')
      .update({ push_sent_at: new Date().toISOString() })
      .eq('id', payload.notification_id);
  }

  return new Response(JSON.stringify({ sent: sentCount }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
