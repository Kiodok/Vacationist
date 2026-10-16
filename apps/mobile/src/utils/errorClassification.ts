// Classifies a thrown mutation error as an *expected* business-rule / permission
// outcome (something the user ran into, e.g. "Guests cannot archive expenses",
// a concurrent-edit "Split not found", an RLS denial) versus a genuine bug.
//
// The API layer (`packages/api/src/*.ts`) does `if (error) throw error;` on every
// Supabase call, so the thrown value is usually a raw PostgrestError-shaped object
// `{ message, details, hint, code }` — NOT an Error instance. Handle both.
//
// Used by the mutation-cache subscriber in queryClient.ts to decide whether to
// forward the error to Sentry. Expected errors already surface to the user as a
// toast via each hook's `onError`; they must not create Sentry issues.

/** Postgres SQLSTATE codes that represent a rule the caller hit, not a defect. */
const EXPECTED_PG_CODES = new Set<string>([
  'P0001', // bare `RAISE EXCEPTION 'text'` — every hand-written check in our migrations
  '42501', // insufficient_privilege — RLS policy denial
  '23505', // unique_violation — e.g. voting twice, duplicate membership (surfaced as a toast)
  'PGRST301', // JWT expired / not authenticated (PostgREST)
]);

/**
 * Substrings of our own `RAISE EXCEPTION` messages. P0001 already covers these,
 * but this is a belt-and-braces net for the ones that matter most and a guard
 * against a future check that ships with an explicit ERRCODE.
 */
const EXPECTED_MESSAGE_FRAGMENTS = [
  'not authenticated',
  'permission denied',
  'not a trip member',
  'not a member of this trip',
  'guests cannot',
  'guest cannot',
  'not found', // "Split not found", "Expense not found", "Activity not found", …
  'rate limit',
  'not allowed',
  'already settled',
  'already a member',
  'cannot be changed',
  'voting is closed',
  'trip is archived',
];

type MaybePgError = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
};

/** True when the value has the shape of a Supabase/PostgREST error object. */
function looksLikePostgresError(e: MaybePgError): boolean {
  return (
    'code' in e ||
    // PostgrestError always carries these keys (often null), a plain Error does not.
    ('details' in e && 'hint' in e)
  );
}

export function isExpectedMutationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const e = error as MaybePgError;
  const { code, message } = e;

  if (typeof code === 'string') {
    if (EXPECTED_PG_CODES.has(code)) return true;
    // Any PostgREST-level error (PGRSTxxx) is a request/permission/shape problem,
    // not a client crash.
    if (code.startsWith('PGRST')) return true;
  }

  // Only trust the message text when this is clearly a DB error object — never
  // suppress a raw JS Error that happens to contain one of these phrases.
  if (
    looksLikePostgresError(e) &&
    typeof message === 'string' &&
    message.length > 0
  ) {
    const lower = message.toLowerCase();
    if (EXPECTED_MESSAGE_FRAGMENTS.some((frag) => lower.includes(frag))) return true;
  }

  return false;
}

/** Substrings seen on a request that never reached the server at all — a dropped connection, DNS
 * failure, or a client-side timeout, as opposed to a server-side rejection. */
const NETWORK_ERROR_MESSAGE_FRAGMENTS = [
  'network request failed', // React Native's fetch polyfill
  'failed to fetch', // browser fetch
  'network error',
  'load failed', // WebKit fetch
  'timeout',
  'timed out',
  'the internet connection appears to be offline',
];

/**
 * True when the request never reached the server at all — a dropped connection, DNS failure, or a
 * client-side timeout — as opposed to a real rejection the server sent back (a business rule, a
 * permission denial, a validation error). A genuinely weak/flaky connection reports this shape
 * repeatedly even while `onlineManager` still believes the device is "online" (NetInfo's
 * `isConnected`/`isInternetReachable` can both read true while individual requests keep timing
 * out) — see `mutations.retry` in queryClient.ts, which uses this to keep retrying rather than
 * give up and roll back an optimistic row the user can see (the "expenses disappear on a flaky
 * connection" report, v1.39.6).
 *
 * Deliberately does NOT use `looksLikePostgresError` (unlike `isExpectedMutationError` above) — a
 * real Postgres/PostgREST error always carries a non-empty `code`, but so does a network failure
 * once `@supabase/postgrest-js` wraps it: when the raw `fetch()` itself throws,
 * `PostgrestBuilder.ts`'s catch handler returns `{ message, details, hint, code: '' }` — every key
 * present, `code` just empty, because there's no SQLSTATE to report. That shape satisfies
 * `looksLikePostgresError`'s key-presence check, so gating on it here would misclassify a genuine
 * network failure (e.g. airplane mode) as "reached the server" — which is exactly what happened:
 * the v1.39.6 "airplane mode -> instant failure, expense never appears" report. The correct test is
 * whether `code` is actually a non-empty string, not merely present.
 *
 * Anything with no real code only counts as a network error when its message actually names a
 * transport failure, or its `name` is `AbortError` (a timeout/cancellation, never a coding
 * mistake). A bare `TypeError` is NOT enough on its own — React Native's "Network request failed"
 * and the browser's "Failed to fetch" are both thrown as `TypeError`, but so is an ordinary
 * null-reference bug elsewhere in the mutation (e.g. "Cannot read properties of undefined") — see
 * `isExpectedMutationError`'s own test for that exact example. Matching on `instanceof TypeError`
 * alone would retry a deterministic bug forever instead of surfacing it, so only the message
 * content (or a genuine AbortError) qualifies.
 */
export function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as MaybePgError & { name?: unknown };

  // A real Postgres/PostgREST error always carries a non-empty code — never a network failure,
  // regardless of message text.
  if (typeof e.code === 'string' && e.code.length > 0) return false;

  if (typeof e.message === 'string') {
    const lower = e.message.toLowerCase();
    if (NETWORK_ERROR_MESSAGE_FRAGMENTS.some((frag) => lower.includes(frag))) return true;
  }

  if (e.name === 'AbortError') return true;

  return false;
}

/**
 * A rejection of the SESSION rather than of the change: an expired/invalid access token, or a request
 * that reached the server unauthenticated. After a long offline stretch the JWT (1 h) has lapsed, so a
 * queued write replayed before the refresh lands fails this way even though the write itself is fine —
 * it must be retried on a fresh session, not treated as a permanent failure.
 */
export function isAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as MaybePgError & { status?: unknown };
  if (e.code === 'PGRST301' || e.code === 'PGRST303' || e.status === 401) return true;
  if (typeof e.message === 'string') {
    const lower = e.message.toLowerCase();
    return lower.includes('jwt expired') || lower.includes('invalid jwt') || lower.includes('not authenticated');
  }
  return false;
}
