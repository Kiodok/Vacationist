import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// ── i18n translation map for push notification types ─────────────────────────
// Maps notification_type → locale → { title, body }
// When a type is not found the caller-supplied title/body is used as fallback.
type NotifTranslation = { title: string; body: string };
type LocaleTranslations = Record<string, NotifTranslation>;
const NOTIFICATION_TRANSLATIONS: Record<string, LocaleTranslations> = {
  new_activity: {
    en: { title: 'New activity added', body: 'A new activity was added to your trip.' },
    de: { title: 'Neue Aktivität', body: 'Eine neue Aktivität wurde zu deiner Reise hinzugefügt.' },
  },
  vote_finalized: {
    en: { title: 'Vote finalized', body: 'The vote on an activity has been finalized.' },
    de: { title: 'Abstimmung abgeschlossen', body: 'Die Abstimmung über eine Aktivität wurde abgeschlossen.' },
  },
  vote_update: {
    en: { title: 'Vote result', body: 'The group has voted on an activity.' },
    de: { title: 'Abstimmungsergebnis', body: 'Die Gruppe hat über eine Aktivität abgestimmt.' },
  },
  expense_change: {
    en: { title: 'Expense update', body: 'An expense has been updated on your trip.' },
    de: { title: 'Ausgabe aktualisiert', body: 'Eine Ausgabe auf deiner Reise wurde aktualisiert.' },
  },
  new_member: {
    en: { title: 'New member joined', body: 'Someone new has joined your trip.' },
    de: { title: 'Neues Mitglied', body: 'Jemand Neues ist deiner Reise beigetreten.' },
  },
  schedule_change: {
    en: { title: 'Schedule changed', body: 'An activity time on your trip has changed.' },
    de: { title: 'Zeitplan geändert', body: 'Die Zeit einer Aktivität auf deiner Reise hat sich geändert.' },
  },
  // 'reminder' is also used for organizer nudges (send_organizer_nudge inserts type='reminder').
  reminder: {
    en: { title: 'Friendly nudge 👋', body: 'Your organizer wants you to check the open votes.' },
    de: { title: 'Freundliche Erinnerung 👋', body: 'Dein Organisator möchte, dass du die offenen Abstimmungen prüfst.' },
  },
  lost_found: {
    en: { title: 'Lost & Found', body: 'A lost or found item was reported on your trip.' },
    de: { title: 'Fundbüro', body: 'Ein verlorener oder gefundener Gegenstand wurde auf deiner Reise gemeldet.' },
  },
  shared_packing: {
    en: { title: 'Shared packing update', body: 'A shared packing item was updated on your trip.' },
    de: { title: 'Gemeinsame Packliste', body: 'Ein gemeinsamer Packlisteneintrag wurde auf deiner Reise aktualisiert.' },
  },
};

function translateNotification(
  type: string,
  locale: string,
  fallbackTitle: string,
  fallbackBody: string,
): { title: string; body: string } {
  const lang = locale?.split('-')[0] ?? 'en';
  const map = NOTIFICATION_TRANSLATIONS[type];
  if (!map) return { title: fallbackTitle, body: fallbackBody };
  return map[lang] ?? map['en'] ?? { title: fallbackTitle, body: fallbackBody };
}
// ─────────────────────────────────────────────────────────────────────────────

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
    case 'lost_found':      return 'lost_found';
    case 'shared_packing':  return 'shared_packing';
    default:                return null;
  }
}

// Constant-time string comparison — prevents timing oracle attacks on the
// service-role key, which bypasses all RLS policies if leaked.
function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
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

  // Fetch the recipient's locale for translation
  const { data: userRow } = await supabase
    .from('users')
    .select('locale')
    .eq('id', payload.user_id)
    .single();
  const locale = (userRow as { locale?: string } | null)?.locale ?? 'en';
  const { title, body: translatedBody } = translateNotification(
    payload.type,
    locale,
    payload.title,
    payload.body ?? '',
  );

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
    title,
    body: translatedBody,
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

  // Fetch tokens and user locales for all eligible users in parallel.
  const [{ data: allTokens }, { data: userLocales }] = await Promise.all([
    supabase
      .from('user_push_tokens')
      .select('user_id, push_token')
      .in('user_id', eligibleUserIds),
    supabase
      .from('users')
      .select('id, locale')
      .in('id', eligibleUserIds),
  ]);

  if (!allTokens || allTokens.length === 0) return jsonResponse({ sent: 0, reason: 'no_tokens' });

  // Build locale lookup map
  const localeMap = new Map<string, string>(
    ((userLocales ?? []) as { id: string; locale: string }[]).map((u) => [u.id, u.locale ?? 'en'])
  );

  // user_ids[i] and notification_ids[i] are positionally aligned.
  const userToNotificationId = new Map(user_ids.map((uid, i) => [uid, notification_ids[i]]));

  const typedTokens = allTokens as TokenRow[];
  const rawTokens = typedTokens.map((t) => t.push_token);
  const messages: ExpoPushMessage[] = typedTokens.map(({ push_token, user_id }, idx) => {
    const locale = localeMap.get(user_id) ?? 'en';
    const translated = translateNotification(type, locale, title, body ?? '');
    return {
      to: rawTokens[idx],
      title: translated.title,
      body: translated.body,
      sound: 'default',
      channelId: 'default',
      data: {
        notificationId: userToNotificationId.get(user_id as string),
        tripId: trip_id,
        type,
        relatedType: related_type,
        relatedId: related_id,
      },
    };
  });

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
  if (!authHeader || !serviceRoleKey || !constantTimeEqual(authHeader, `Bearer ${serviceRoleKey}`)) {
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
