---
name: profile-settings-encrypted-docs
description: Use when touching the profile settings screen, encrypted travel documents, or the organizer document-access system — covers pgcrypto encryption, SECURITY DEFINER RPC access pattern, biometric gating, and file locations.
---

# Profile settings & encrypted travel documents

A full Profile Settings feature including encrypted travel document storage and a time-limited organizer document access system.

**Why:** Users need a place to manage their profile and optionally store booking-relevant ID/passport details securely.

**How to apply:** When touching profile, travel documents, or document access features, reference the files listed below.

## Key files

- Migrations: `supabase/migrations/20260525000001_enable_pgcrypto_and_vault_secret.sql`, `...000002_create_user_travel_documents.sql`, `...000003_create_document_access_system.sql`
- API service: `packages/api/src/travelDocuments.ts` (used `unknown` casts until DB types were regenerated — check whether that workaround is still present)
- Hooks: `apps/mobile/src/features/profile/hooks/` (6 files)
- Components: `apps/mobile/src/features/profile/components/` (8 components)
- Profile screen: `apps/mobile/app/(tabs)/profile.tsx`
- Organizer access UI: added to `apps/mobile/app/trip/[id]/settings.tsx`

## Architecture decisions

- pgcrypto AES-256 via `extensions.pgp_sym_encrypt`/`pgp_sym_decrypt` + key in Supabase Vault.
- All table access via SECURITY DEFINER RPCs; direct INSERT/UPDATE/DELETE blocked by RLS.
- Travel documents: `staleTime: 0, gcTime: 0` — never cached in TanStack Query.
- Biometric gate uses `expo-local-authentication`; `BiometricGate` accepts `unlocked` + `onUnlocked` props (state lifted to the screen).
- Document number masked by default (`****1234`), reveal toggle in `TravelDocumentCard`.
- Access request rate-limited to 1 per trip per 24h; grants have `expires_at` server-side.

## Follow-up noted at the time

Run `supabase gen types typescript --project-id <id> > packages/api/src/database.types.ts` then remove the `rpc` bind workaround in `travelDocuments.ts` — verify whether this was already done before assuming it's still outstanding.
