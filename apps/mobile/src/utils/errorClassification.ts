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
