import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// ── i18n translation map for push notification types ─────────────────────────
// Maps notification_type → locale → { title, body }
// Body templates support {{entity}}, {{trip}}, {{creator}} placeholders.
type NotifTranslation = { title: string; body: string };
type LocaleTranslations = Record<string, NotifTranslation>;
const NOTIFICATION_TRANSLATIONS: Record<string, LocaleTranslations> = {
  new_activity: {
    en: { title: 'New activity added', body: '{{creator}} added "{{entity}}" to "{{trip}}".' },
    de: { title: 'Neue Aktivität', body: '{{creator}} hat "{{entity}}" zu "{{trip}}" hinzugefügt.' },
  },
  vote_finalized: {
    en: { title: 'Voting finalized', body: 'Voting is closed for "{{entity}}" in "{{trip}}".' },
    de: { title: 'Abstimmung abgeschlossen', body: 'Die Abstimmung zu "{{entity}}" in "{{trip}}" ist abgeschlossen.' },
  },
  vote_update: {
    en: { title: 'Vote result', body: 'The group has voted on "{{entity}}".' },
    de: { title: 'Abstimmungsergebnis', body: 'Die Gruppe hat über "{{entity}}" abgestimmt.' },
  },
  expense_change: {
    en: { title: 'New expense added', body: '{{creator}} added "{{entity}}" to "{{trip}}".' },
    de: { title: 'Neue Ausgabe', body: '{{creator}} hat "{{entity}}" zu "{{trip}}" hinzugefügt.' },
  },
  new_member: {
    en: { title: 'New member joined', body: '{{creator}} is now part of "{{trip}}".' },
    de: { title: 'Neues Mitglied', body: '{{creator}} ist jetzt Teil von "{{trip}}".' },
  },
  schedule_change: {
    en: { title: 'Schedule updated', body: '"{{entity}}" in "{{trip}}" has been rescheduled.' },
    de: { title: 'Zeitplan geändert', body: '"{{entity}}" in "{{trip}}" wurde neu geplant.' },
  },
  // 'reminder' covers both trip reminders (context_trip set) and organizer nudges (no context).
  // The translateNotification function uses context_trip presence to distinguish them.
  reminder: {
    en: { title: 'Trip reminder', body: 'Your trip "{{trip}}" starts soon. Time to get ready!' },
    de: { title: 'Reiseerinnerung', body: 'Deine Reise "{{trip}}" beginnt bald. Zeit, sich fertig zu machen!' },
  },
  lost_found: {
    en: { title: 'Lost or Found', body: '{{creator}} reported "{{entity}}" in "{{trip}}".' },
    de: { title: 'Fundbüro', body: '{{creator}} hat "{{entity}}" in "{{trip}}" gemeldet.' },
  },
  // Virtual types: personal notifications to the tagged member use specific titles.
  // Detected below via fallbackTitle matching (same pattern as shared_packing_self).
  lost_found_found: {
    en: { title: 'Item found', body: '{{creator}} thinks you may have: "{{entity}}".' },
    de: { title: 'Gegenstand gefunden', body: '{{creator}} denkt, du könntest "{{entity}}" haben.' },
  },
  lost_found_lost: {
    en: { title: 'Item lost', body: '{{creator}} thinks you may have: "{{entity}}".' },
    de: { title: 'Gegenstand verloren', body: '{{creator}} denkt, du könntest "{{entity}}" haben.' },
  },
  lost_found_resolved: {
    en: { title: 'Case resolved', body: '"{{entity}}" has been marked as resolved in "{{trip}}".' },
    de: { title: 'Fall gelöst', body: '"{{entity}}" wurde in "{{trip}}" als gelöst markiert.' },
  },
  lost_found_reopened: {
    en: { title: 'Case reopened', body: '"{{entity}}" has been reopened in "{{trip}}".' },
    de: { title: 'Fall wieder geöffnet', body: '"{{entity}}" wurde in "{{trip}}" wieder geöffnet.' },
  },
  activity_note: {
    en: { title: 'Note added', body: '{{creator}} added a note to "{{entity}}" in "{{trip}}".' },
    de: { title: 'Notiz hinzugefügt', body: '{{creator}} hat eine Notiz zu "{{entity}}" in "{{trip}}" hinzugefügt.' },
  },
  shared_packing: {
    en: { title: 'Shared packing update', body: '{{creator}} added "{{entity}}" for everyone in "{{trip}}".' },
    de: { title: 'Gemeinsame Packliste', body: '{{creator}} hat "{{entity}}" für alle in "{{trip}}" hinzugefügt.' },
  },
  // Virtual key for i_got_it notifications — they reuse DB type='shared_packing' but
  // their body starts with 'For "', which we detect below to pick the right template.
  // Keep in sync with BODY_TEMPLATES in apps/mobile/src/features/notifications/components/NotificationItem.tsx.
  shared_packing_self: {
    en: { title: 'Shared packing update', body: '{{creator}} is bringing "{{entity}}" for "{{trip}}".' },
    de: { title: 'Gemeinsame Packliste', body: '{{creator}} bringt "{{entity}}" für "{{trip}}".' },
  },
};

interface NotifContext {
  entity?: string | null;
  trip?: string | null;
  creator?: string | null;
}

function interpolate(template: string, ctx: NotifContext): string {
  return template
    .replaceAll('{{entity}}', ctx.entity ?? '')
    .replaceAll('{{trip}}', ctx.trip ?? '')
    .replaceAll('{{creator}}', ctx.creator ?? '');
}

function translateNotification(
  type: string,
  locale: string,
  fallbackTitle: string,
  dbBody: string | null,
  context?: NotifContext,
): { title: string; body: string } {
  const lang = locale?.split('-')[0] ?? 'en';

  // i_got_it shared packing notifications reuse DB type='shared_packing' but their body
  // starts with 'For "' — route them to the dedicated template so we don't incorrectly
  // say the item was added "for everyone".
  // lost_found notifications all share one DB type; the DB triggers distinguish the
  // personal ('Item found'/'Item lost') and lifecycle ('Case resolved'/'Case reopened')
  // variants via the stored English title. Keep in sync with resolveEffectiveType in
  // apps/mobile/src/features/notifications/components/NotificationItem.tsx.
  const effectiveType =
    type === 'shared_packing' && dbBody?.startsWith('For "') ? 'shared_packing_self' :
    type === 'lost_found' && fallbackTitle === 'Item found' ? 'lost_found_found' :
    type === 'lost_found' && fallbackTitle === 'Item lost' ? 'lost_found_lost' :
    type === 'lost_found' && fallbackTitle === 'Case resolved' ? 'lost_found_resolved' :
    type === 'lost_found' && fallbackTitle === 'Case reopened' ? 'lost_found_reopened' :
    type;

  const map = NOTIFICATION_TRANSLATIONS[effectiveType];
  const translated = map ? (map[lang] ?? map['en']) : null;

  const hasContext = context && (context.entity != null || context.trip != null || context.creator != null);

  // For nudges (type='reminder', no context_trip): use the DB title/body — it is already
  // translated by the organizer's client before being stored. For trip reminders
  // (type='reminder', context_trip is set) and all other types: use the translated template.
  const isNudge = type === 'reminder' && !context?.trip;
  const title = isNudge ? fallbackTitle : (translated?.title ?? fallbackTitle);

  let body: string;
  // Guard: if the template uses {{trip}} but context_trip is null (e.g. a "claimed"
  // shared-packing notification), rendering would produce an empty trip name.
  const templateNeedsTrip = translated?.body?.includes('{{trip}}') ?? false;
  if (templateNeedsTrip && !context?.trip) {
    body = dbBody ?? '';
  } else if (hasContext && translated?.body && !isNudge) {
    body = interpolate(translated.body, context!);
  } else {
    body = dbBody ?? translated?.body ?? '';
  }

  return { title, body };
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
  context_entity?: string | null;
  context_trip?: string | null;
  context_creator?: string | null;
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
  context_entity?: string | null;
  context_trip?: string | null;
  context_creator?: string | null;
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
    case 'lost_found':      return null;
    case 'activity_note':   return 'new_activity';
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

// Every handled notification MUST be marked, including preference-off / no-token /
// stale-token outcomes — pg_cron retries any row left with push_sent_at IS NULL
// every 5 minutes (see 20260611180000_fix_push_invocation_flood.sql).
async function markPushSent(notificationIds: string[]): Promise<void> {
  if (notificationIds.length === 0) return;
  await supabase
    .from('notifications')
    .update({ push_sent_at: new Date().toISOString() })
    .in('id', notificationIds);
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
      await markPushSent([payload.notification_id]);
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
    payload.body,
    {
      entity: payload.context_entity,
      trip: payload.context_trip,
      creator: payload.context_creator,
    },
  );

  const { data: tokens } = await supabase
    .from('user_push_tokens')
    .select('push_token')
    .eq('user_id', payload.user_id);

  if (!tokens || tokens.length === 0) {
    await markPushSent([payload.notification_id]);
    return jsonResponse({ sent: 0, reason: 'no_tokens' });
  }

  const rawTokens = (tokens as TokenRow[]).map((t) => t.push_token);
  const messages: ExpoPushMessage[] = rawTokens.map((token) => ({
    to: token,
    title,
    body: translatedBody,
    sound: 'default',
    channelId: 'default-v2',
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

  // Always mark — even if sent=0 (all stale tokens) — so pg_cron stops retrying.
  await markPushSent([payload.notification_id]);

  return jsonResponse({ sent });
}

async function handleBatch(payload: BatchNotificationPayload): Promise<Response> {
  const {
    trip_id, type, title, body, related_type, related_id,
    notification_ids, user_ids,
    context_entity, context_trip, context_creator,
  } = payload;
  const context: NotifContext = { entity: context_entity, trip: context_trip, creator: context_creator };

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

  if (eligibleUserIds.length === 0) {
    await markPushSent(notification_ids);
    return jsonResponse({ sent: 0, reason: 'all_preferences_off' });
  }

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

  if (!allTokens || allTokens.length === 0) {
    await markPushSent(notification_ids);
    return jsonResponse({ sent: 0, reason: 'no_tokens' });
  }

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
    const translated = translateNotification(type, locale, title, body, context);
    return {
      to: rawTokens[idx],
      title: translated.title,
      body: translated.body,
      sound: 'default',
      channelId: 'default-v2',
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

  // Always mark all rows — pg_cron must not retry them.
  await markPushSent(notification_ids);

  return jsonResponse({ sent });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  // PUSH_NOTIFICATION_SECRET is a dedicated edge function secret — independent of
  // Supabase's own key format so it works regardless of JWT vs sb_secret_* migration.
  const pushSecret = Deno.env.get('PUSH_NOTIFICATION_SECRET');
  if (!authHeader || !pushSecret || !constantTimeEqual(authHeader, `Bearer ${pushSecret}`)) {
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
