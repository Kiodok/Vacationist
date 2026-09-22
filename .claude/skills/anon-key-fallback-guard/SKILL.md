---
name: anon-key-fallback-guard
description: Use whenever adding or reviewing a read function in packages/api/src — any `.select()`, `.single()`, `.maybeSingle()`, or list/nullable-returning RPC call. Also use when debugging "correct data offline, then it looks empty/gone after a flaky reconnect" or "a role/permission-gated control disappeared while offline." Explains why an empty or not-found result from Supabase cannot always be trusted, and the required guard.
---

# The anon-key-fallback trap in packages/api reads

**Rule:** every authenticated read in `packages/api/src` that can legitimately return "nothing" (an
empty array, or `null`/`undefined` for a single row) must pass that result through
`trustEmptyList()` / `trustNullResult()` (`packages/api/src/session.ts`) before returning it — unless
the function is genuinely pre-auth (`auth.ts`, `restoreCredentials.ts`, `invites.ts`'s public invite
preview).

**Why:** supabase-js silently falls back to the **anon key** when `getSession()` (or its token
refresh) fails — typically: an access token expired during a long offline stretch, then the reconnect
refresh itself is still in flight or fails. Against RLS, that anon-key request doesn't error — it
just gets filtered to **zero rows**, indistinguishable at the call site from a genuine "you really
have none of these." A function that returns that result as a normal success (or, worse, converts an
error into a trusted `null` — the original shape of this bug, `getCurrentMemberRole` in
`members.ts`) lets TanStack Query cache — and within seconds, persist to disk — a **false negative**
over data that was correctly prefetched moments before.

Confirmed real-world fallout (v1.39.0 round 3, 22.09 test session): the shopping delete icon,
activity Edit/Close-voting/Reopen-voting, and the trip Overview "Edit trip" pencil all vanished
offline because `getCurrentMemberRole` silently returned `null`, overwriting the cached
`'organizer'`/`'participant'` role for everyone. The same mechanism also explained a trip randomly
showing "could not be loaded" offline (`TripNotFoundError`'s PGRST116 triggered an unwarranted cache
purge) and Prework showing a false "no topics yet" after reconnecting.

**How to apply:**
- List read (`Promise<T[]>`): `return trustEmptyList(data as T[]);` at the very end, after the
  existing `if (error) throw error;` — never instead of it. A non-empty result is always trusted; an
  empty one only when `looksSessionValid()` (no network call — reads the same on-disk session blob as
  `readStoredSession()`).
- Single nullable read (`.maybeSingle()`, or an RPC returning `null` for "not found"): use
  `trustNullResult()` the same way.
- Single non-nullable read (`.single()`): no wrapper needed **if** it already does a bare
  `if (error) throw error;` — `.single()` turns 0 rows into PGRST116, which already throws and so
  already preserves the cache. The dangerous pattern is specifically converting that error into a
  **trusted return value** (`if (error) return null`) — see `getCurrentMemberRole` for the one
  correct exception: a genuine "not a member" (PGRST116 **and** `looksSessionValid()`) should
  legitimately resolve `null`, but anything else must throw.
- Don't wrap a deliberate early-return for a genuinely-empty INPUT (e.g.
  `if (tripIds.length === 0) return [];` before any query even runs) — that's not a trust question.
- `getTripTabContent`-shaped functions (a single object with a client-computed all-false fallback,
  not a list/nullable) are a deliberate scope boundary — low stakes (only the tab "has content" dot),
  not covered by the round-3 sweep.

This was a **full audit** of `packages/api` as of 2026-09-22 — every read at that time got the guard.
A *new* read added later does not get it automatically; apply this rule to it yourself.

Related: [[offline-session-durability]] (the session-trust philosophy this extends),
[[offline-client-generated-ids]].
