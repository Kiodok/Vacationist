---
name: network-error-classification-shape-gate
description: Use before touching errorClassification.ts's isNetworkError(), or any new classifier there that needs to distinguish "reached the server" from "never left the device" — gating on whether code/details/hint keys exist is not enough, since @supabase/postgrest-js wraps a genuine fetch() failure into {message, details, hint, code: ''}, every key present but code empty. Check for a non-empty code instead. Fixed 2026-10-16.
---

`apps/mobile/src/utils/errorClassification.ts`'s `isNetworkError()` must not gate on whether an
error object merely *has* `code`/`details`/`hint` keys (the `looksLikePostgresError` helper). When
the raw `fetch()` call itself throws — genuinely no network at all, exactly airplane mode —
`@supabase/postgrest-js`'s catch handler (`PostgrestBuilder.ts`) wraps it into
`{ message, details: <stack/cause text>, hint: '', code: '' }`: every key present, `code` just an
empty string, because there's no SQLSTATE to report. A presence-only check treats this identically
to a real Postgres/PostgREST error and misclassifies it as "reached the server" — which caused a
real bug: airplane mode showed an instant failure toast and the just-created expense was rolled
back and never appeared, instead of being paused and synced once connectivity returned.

**Why:** found during the Tech Lead's manual QA pass against the v1.39.6 checklist. Root-caused by
reading the installed `@supabase/postgrest-js` source directly, not guessed — see the
`project_v1_39_6_batch` skill for the full story.

**How to apply:**
- `isNetworkError()` checks `typeof e.code === 'string' && e.code.length > 0` to rule out a real
  server-side error — never mere key presence. Every genuine Postgres/PostgREST error always has a
  non-empty code (`P0001`, `23505`, `PGRST116`, …); this wrapped network failure never does.
- `isExpectedMutationError()` (the separate Sentry-suppression classifier) still uses the old
  key-presence helper and was deliberately left untouched — out of scope, no reported bug there.
  Don't assume it's fixed too.
- Any new classifier added to this file that needs the same "reached the server vs. not"
  distinction should check for a non-empty `code`, never just whether the keys exist.
