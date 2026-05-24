# Vacationist – Implementation Master Plan (Claude Opus 4.6)

## 📌 Rules of Engagement for Claude
When working through this document, Claude must act as a **Senior Fullstack Engineer** operating under the following strict guidelines:
1. **Never build the whole app at once:** Only execute the specifically assigned phase and layer.
2. **Layer-by-Layer Execution:** For every feature, build in this exact order: 
   * *DB/RLS → Types → Services → Hooks → Components → Screens.*
3. **No Architectural Freestyling:** Strictly follow the tech stack (React Native, Expo Router, Supabase, TanStack Query, Zustand, NativeWind).
4. **Assume Nothing:** If a UX flow or business rule is missing from the prompt, stop and ask the Tech Lead. 
5. **Reference the Guide:** Always refer to `software_engineering_guide.md` for specific table schemas, color tokens, and business logic (e.g., voting semantics, expense logic).

---

## 💡 How to Prompt Claude with this Checklist

When you are ready to start a task, copy the specific sub-item and format your prompt like this:

> **Role:** You are the senior engineer for Vacationist.
> **Context:** React Native, Expo Router, Supabase, TanStack Query, Zustand, NativeWind. Read `software_engineering_guide.md` for standards.
> **Task:** We are on Phase X, Step Y: [Insert Checkbox Task Here].
> **Requirements:** [List specific constraints from the guide]
> **Deliverables:** Provide the exact code for this layer only. Do not build the frontend yet.

---

## 🛠️ Phase 0: Infrastructure Foundation
*Goal: Set up the monorepo, tooling, and core utilities before writing any product features.*

- [x] **1. Monorepo Setup**
  - [x] Initialize `/apps/mobile` (Expo Router + React Native)
  - [x] Initialize `/packages/ui` (NativeWind config, base design tokens)
  - [x] Initialize `/packages/types` (Shared TS interfaces and Zod schemas)
  - [x] Initialize `/packages/utils` (Day.js timezone/UTC config, string formatters)
  - [x] Initialize `/packages/api` (Supabase client initialization)
- [x] **2. Database Foundation**
  - [x] Setup Supabase project environment
  - [x] Create `/supabase/migrations` directory structure
- [x] **3. Frontend Core Providers**
  - [x] Wrap app with TanStack Query provider
  - [x] Implement `<GlobalErrorBoundary>` and screen-level fallbacks
  - [x] Create Zustand `toastStore` and global Toast UI component

---

## 🔐 Phase 1: Authentication & Identity
*Goal: Implement the auth foundation, guest model, and protected routing.*

### Google Sign-In (Native SDK + Supabase signInWithIdToken)
Switched from browser-based OAuth (expo-auth-session + expo-web-browser) to native Google Sign-In
(`@react-native-google-signin/google-signin`) with `signInWithIdToken`. Requires development build (not Expo Go).

**Google Cloud / Firebase:**
- GCP Project: `vacationist` (project number: 632483929424)
- Web Client ID: stored in `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` env var
- Android OAuth Client ID: registered in GCP with package `com.vacationist.mobile` + SHA-1/SHA-256
- Firebase: linked to same GCP project for `google-services.json`

**Supabase Auth config:**
- Google provider uses the same Web Client ID
- Redirect URLs: `vacationist://`, `exp+vacationist://`
- OAuth app Client ID: 9d40a6d2-1601-4049-94e6-207628f0c073
- Public Client: enabled

**Auth flow (native):** GoogleSignin.signIn() → idToken → supabase.auth.signInWithIdToken() → session
**Auth flow (web):** Browser-based OAuth via getGoogleOAuthUrl() (unchanged)

### Steps Phase 1
- [x] **1. DB/RLS & Types**
  - [x] Create `users` table schema and RLS policies
  - [x] Generate TypeScript interfaces for User and Guest states
- [x] **2. Services & Hooks**
  - [x] Implement Supabase Auth service (Google OAuth, Magic Links)
  - [x] Setup Zustand store for active session/user state ONLY
- [x] **3. Components & Screens**
  - [x] Build base Auth UI components (Inputs, Primary/Secondary Buttons)
  - [x] Implement Login and Magic Link screens
  - [x] Build Expo Router auth guards (protected route redirection)
  - [x] Implement basic "Join via Link" guest identity flow

---

## 🧳 Phase 2: Trips Foundation
*Dependencies: Phase 1*
*Goal: Core CRUD for trips and member management.*

- [x] **1. DB/RLS & Types**
  - [x] Create `trips` and `trip_members` tables with RLS
  - [x] Create `invite_tokens` table with expiry/usage logic
  - [x] Generate Zod schemas for trip creation and validation
- [x] **2. Services & Hooks**
  - [x] Create trip CRUD services and member management services
  - [x] Implement TanStack Query hooks (`useTrips`, `useTrip`, `useCreateTrip`)
- [x] **3. Components & Screens**
  - [x] Build `TripCard`, `MemberAvatar`, and layout primitives
  - [x] Implement Trip List screen (`/app/(tabs)`)
  - [x] Implement Trip Detail shell (Header + Navigation tabs)
  - [x] Implement Trip Settings (Manage members, generate invites)

---

## 🎯 Phase 3: Activities & Voting System
*Dependencies: Phase 2*
*Goal: Activity planning and the non-numerical voting engine.*

- [x] **1. DB/RLS & Types**
  - [x] Create `activities` and `activity_votes` tables + RLS
  - [x] Define Vote TypeScript enums (`must_do`, `like`, `open`, `skip`, `group_blocker`)
- [x] **2. Services & Hooks**
  - [x] Implement Activity CRUD and optimistic Vote Upsert services
  - [x] Implement auto-finalization logic (trigger when all members vote)
  - [x] Create `useActivities` and `useCastVote` TanStack Query hooks
- [x] **3. Components & Screens**
  - [x] Build `ActivityCard` and `VoteChip` UI components
  - [x] Implement Bottom Sheet for vote casting/breakdown
  - [x] Implement Activity List screen and Activity Detail screen

---

## 🏠 Phase 4a: Accommodations
*Dependencies: Phase 3*
*Goal: Suggesting and voting on places to stay.*

- [x] **1. DB/RLS & Types**
  - [x] Create `accommodations` and `accommodation_votes` tables + RLS
- [x] **2. Services & Hooks**
  - [x] Implement Accommodation CRUD services
  - [x] Extend existing voting hooks to support accommodation entities
- [x] **3. Components & Screens**
  - [x] Build Accommodation specific UI elements (price displays, external link buttons)
  - [x] Implement Accommodation List and Detail screens

---

## 💸 Phase 4b: Expenses
*Dependencies: Phase 2*
*Goal: Shared cost tracking (No payments, just tracking).*

- [x] **1. DB/RLS & Types**
  - [x] Create `expenses` and `expense_splits` tables + RLS
  - [x] Define currency constants and types
- [x] **2. Services & Hooks**
  - [x] Implement Expense creation service
  - [x] Implement split calculation logic (e.g., divide by selected members)
  - [x] Create TanStack Query hooks for expenses
- [x] **3. Components & Screens**
  - [x] Build `ExpenseListItem` and settlement status badges
  - [x] Implement Expense List screen
  - [x] Implement Add Expense Form (React Hook Form + Zod)

---

## 🛒 Phase 5a: Realtime Shopping Lists
*Dependencies: Phase 2*
*Goal: Collaborative, real-time list management.*

- [x] **1. DB/RLS & Types**
  - [x] Create `shopping_lists` and `shopping_items` tables + RLS
- [x] **2. Services & Hooks**
  - [x] Implement List and Item CRUD services
  - [x] **Realtime Setup:** Implement Supabase Realtime channel subscription for item statuses
  - [x] Implement reconnection logic and heartbeat handling for realtime
- [x] **3. Components & Screens**
  - [x] Build interactive Checkbox/Item components (Optimistic UI required)
  - [x] Implement Shopping List view

## 🎯 Phase 5b: Realtime Voting System for Accommodations/Places & Activities
*Dependencies: Phases 3, 4a, 4b & 5a*
*Goal: Collaborative, real-time voting on activities & places to stay.*

- [x] **1. Realtime voting on activities**
- [x] **2. Realtime voting on places**
- [x] **3. Ensure alignment with Phase 5a functionalities & logic**

## 🛒 Phase 5c: Realtime Expenses
*Dependencies: Phases 3, 4a, 4b, 5a & 5b*
*Goal: Collaborative, real-time expenses.*

- [x] **1. Realtime handling of expenses**
- [x] **2. Ensure alignment with Phase 5a & 5b functionalities & logic**

---

## 🍳 Phase 6: Recipes
*Dependencies: Phase 5a, 5b & 5c*
*Goal: Recipe management that pipes directly into shopping lists.*

- [x] **1. DB/RLS & Types**
  - [x] Create `recipes` and `recipe_ingredients` tables + RLS
- [x] **2. Services & Hooks**
  - [x] Implement Recipe CRUD services
  - [x] Implement Ingredient-to-Shopping-Item sync logic (Duplicate merging logic)
  - [x] **Realtime Setup:** Implement Supabase Realtime channel subscription
  - [x] Create Recipe query hooks
- [x] **3. Components & Screens**
  - [x] Implement Recipe List and Detail screens
  - [x] Implement "Add to Shopping List" action flow

---

## 📅 Phase 7: Calendar
*Dependencies: Phases 2 & 3*
*Goal: Timezone-aware visual schedule.*

- [x] **1. Logic & Utils**
  - [x] Implement timezone resolution using trip configuration + `dayjs.tz`
- [x] **2. Services & Hooks**
  - [x] **Realtime Setup:** Implement Supabase Realtime channel subscription
- [x] **3. Components & Screens**
  - [x] Build visual Calendar primitives (Day blocks, event pills)
  - [x] Implement Trip Calendar Screen
  - [x] Implement Global Calendar Screen

---

## 🔍 Phase 7b: Prework (Base Search Preferences)
*Dependencies: Phase 2 (Trips)*
*Goal: Collect (credit) weighted filter preferences from all members to guide the organizer's external accommodation search.*

- [x] **1. DB/RLS & Types**
  - [x] Create `prework_preferences` table (JSONB filters) + RLS policies
  - [x] Add `PreworkFilter` and `PreworkPreferences` TypeScript interfaces
  - [x] Add Zod schemas with 100 credits weight-sum validation
- [x] **2. Services & Hooks**
  - [x] Implement prework CRUD services (get all, get mine, upsert, delete)
  - [x] Create TanStack Query hooks (`usePreworkPreferences`, `useMyPreworkPreferences`, `useUpsertPreworkPreferences`)
- [x] **3. Components & Screens**
  - [x] Build `MyPreferencesSection` (inline filter editor with weight inputs and live sum counter)
  - [x] Build `GroupSummarySection` (aggregated ranked filter list with per-member breakdown)
  - [x] Implement Prework tab screen (between Overview and Base)
  - [x] Build `aggregateFilters` utility for client-side weight averaging

---

## ✈️ Phase 7c: Transfer (Flights, Vehicles, Rental Cars)
*Dependencies: Phases 2, 3, 5b (Trips, Voting System, Realtime Voting)*
*Goal: Organize trip transportation — flights with voting, personal vehicles with passenger assignments, and rental car booking details. Tab sits between Base and Activities.*

- [x] **1. DB/RLS & Types**

  **Migration 1 — `20260522000001_create_transfer_flights_and_votes.sql`**

  - [x] **1.1 `transfer_flights` table + RLS**
    - [x] `id` UUID PK, `trip_id` FK→trips CASCADE, `title` TEXT(100), `description` TEXT(1000), `direction` TEXT CHECK('outbound','return'), `airline` TEXT(100), `departure_airport` TEXT(100), `arrival_airport` TEXT(100), `departure_time` TIMESTAMPTZ, `arrival_time` TIMESTAMPTZ, `price_per_person` NUMERIC(10,2), `external_url` TEXT(2048) HTTPS-only, `flight_number` TEXT(20) *(post-booking)*, `booking_reference` TEXT(50) *(post-booking)*, `notes` TEXT(500), `status` TEXT DEFAULT 'suggested' CHECK('suggested','booked','completed'), `voting_open` BOOLEAN DEFAULT TRUE, `created_by` FK→users, `created_at`, `updated_at` (trigger), `deleted_at`
    - [x] RLS SELECT: trip member + not deleted | INSERT: trip member, created_by = auth.uid() | UPDATE: organizer any, creator own
    - [x] `restrict_transfer_flight_update_fields()` trigger — prevent changing trip_id/created_by; only organizers can change voting_open, status, flight_number, booking_reference
    - [x] Indexes on trip_id (WHERE deleted_at IS NULL), created_by
  - [x] **1.2 `transfer_flight_votes` table + RLS + auto-finalize trigger**
    - [x] `id` UUID PK, `flight_id` FK→transfer_flights CASCADE, `user_id` FK→users CASCADE, `vote` TEXT CHECK (5 vote types), `created_at`. UNIQUE(flight_id, user_id)
    - [x] RLS: same pattern as `activity_votes` (trip member SELECT, own vote INSERT/UPDATE/DELETE, voting_open gate)
    - [x] `auto_finalize_transfer_flight_voting()` SECURITY DEFINER trigger — sets voting_open=FALSE when all members voted
    - [x] Indexes on flight_id, user_id
  - [x] **1.3 SECURITY DEFINER RPCs for flights**
    - [x] `soft_delete_transfer_flight(p_flight_id)` — organizer deletes any, participant own, guest cannot
    - [x] `close_transfer_flight_voting(p_flight_id)` — organizer only
    - [x] `reopen_transfer_flight_voting(p_flight_id)` — organizer only
    - [x] `book_transfer_flight(p_flight_id, p_flight_number DEFAULT NULL, p_booking_reference DEFAULT NULL)` — organizer only, atomically sets status='booked' + voting_open=FALSE

  **Migration 2 — `20260522000002_create_transfer_flight_passengers.sql`**

  - [x] **1.4 `transfer_flight_passengers` table + RLS**
    - [x] `id` UUID PK, `flight_id` FK→transfer_flights CASCADE, `user_id` FK→users CASCADE, `created_at`. UNIQUE(flight_id, user_id)
    - [x] BEFORE INSERT trigger: verify flight status='booked'
    - [x] RLS SELECT: trip member | INSERT/DELETE: organizer only
    - [x] `set_transfer_flight_passengers(p_flight_id UUID, p_user_ids UUID[])` RPC — SECURITY DEFINER, deletes existing + inserts new set atomically (organizer only)
    - [x] Index on flight_id

  **Migration 3 — `20260522000003_create_transfer_vehicles_and_passengers.sql`**

  - [x] **1.5 `transfer_vehicles` table + RLS**
    - [x] `id` UUID PK, `trip_id` FK→trips CASCADE, `title` TEXT(100), `direction` TEXT CHECK('outbound','return'), `notes` TEXT(500), `created_by` FK→users, `created_at`, `updated_at` (trigger), `deleted_at`
    - [x] RLS SELECT: trip member + not deleted | INSERT: trip member | UPDATE: organizer or creator
    - [x] `soft_delete_transfer_vehicle(p_vehicle_id)` RPC — SECURITY DEFINER
    - [x] Indexes on trip_id (WHERE deleted_at IS NULL), created_by
  - [x] **1.6 `transfer_vehicle_passengers` table + RLS**
    - [x] `id` UUID PK, `vehicle_id` FK→transfer_vehicles CASCADE, `user_id` FK→users CASCADE, `is_driver` BOOLEAN DEFAULT FALSE, `created_at`. UNIQUE(vehicle_id, user_id)
    - [x] RLS SELECT: trip member (via join) | INSERT/UPDATE/DELETE: organizer or vehicle creator
    - [x] Index on vehicle_id

  **Migration 4 — `20260522000004_create_transfer_rentals.sql`**

  - [x] **1.7 `transfer_rentals` table + RLS**
    - [x] `id` UUID PK, `trip_id` FK→trips CASCADE, `title` TEXT(100), `company` TEXT(100), `pickup_location` TEXT(200), `dropoff_location` TEXT(200), `pickup_date` TIMESTAMPTZ, `dropoff_date` TIMESTAMPTZ, `booking_reference` TEXT(50), `price_total` NUMERIC(10,2), `external_url` TEXT(2048) HTTPS-only, `notes` TEXT(500), `created_by` FK→users, `created_at`, `updated_at` (trigger), `deleted_at`
    - [x] RLS SELECT: trip member + not deleted | INSERT: trip member | UPDATE: organizer or creator
    - [x] `soft_delete_transfer_rental(p_rental_id)` RPC — SECURITY DEFINER
    - [x] Indexes on trip_id (WHERE deleted_at IS NULL), created_by

  **Migration 5 — `20260522000005_enable_transfer_realtime.sql`**

  - [x] **1.8 Enable Realtime publication**
    - [x] Add transfer_flights, transfer_flight_votes, transfer_flight_passengers, transfer_vehicles, transfer_vehicle_passengers, transfer_rentals to `supabase_realtime`
    - [x] `REPLICA IDENTITY FULL` on transfer_flight_votes, transfer_flight_passengers, transfer_vehicle_passengers

  **Types & Schemas**

  - [x] **1.9 Enums (`packages/types/src/enums.ts`)**
    - [x] `TRANSFER_FLIGHT_STATUS = ['suggested', 'booked', 'completed'] as const` + type `TransferFlightStatus`
    - [x] `TRANSFER_DIRECTION = ['outbound', 'return'] as const` + type `TransferDirection`
  - [x] **1.10 Interfaces (`packages/types/src/database.ts`)**
    - [x] `TransferFlight`, `TransferFlightVote`, `TransferFlightPassenger`
    - [x] `TransferVehicle`, `TransferVehiclePassenger`
    - [x] `TransferRental`
  - [x] **1.11 Zod schemas (`packages/types/src/schemas.ts`)**
    - [x] `createTransferFlightSchema` / `updateTransferFlightSchema` / `bookTransferFlightSchema`
    - [x] `createTransferVehicleSchema` / `updateTransferVehicleSchema`
    - [x] `createTransferRentalSchema` / `updateTransferRentalSchema`
    - [x] Export all input types (`CreateTransferFlightInput`, `UpdateTransferFlightInput`, `BookTransferFlightInput`, etc.)

- [x] **2. Services & Hooks**
  - [x] **2.1 `packages/api/src/transferFlights.ts`**
    - [x] CRUD: `getTransferFlights` (ordered by direction ASC, created_at DESC), `getTransferFlight`, `createTransferFlight`, `updateTransferFlight`, `softDeleteTransferFlight`
    - [x] Voting control: `closeTransferFlightVoting`, `reopenTransferFlightVoting`, `bookTransferFlight`
    - [x] Votes: `getTransferFlightVotes`, `getTransferFlightVotesBatch`, `castTransferFlightVote` (upsert on conflict), `removeTransferFlightVote`
    - [x] Passengers: `getTransferFlightPassengers`, `setTransferFlightPassengers` (calls RPC)
    - [x] Realtime: `FlightVotingRealtimeCallbacks` interface + `subscribeToFlightVotingRealtime(tripId, callbacks, onStatus)` subscribing to votes, flight updates, and passenger changes + `unsubscribeFromFlightVoting`
  - [x] **2.2 `packages/api/src/transferVehicles.ts`**
    - [x] CRUD: `getTransferVehicles`, `createTransferVehicle`, `updateTransferVehicle`, `softDeleteTransferVehicle`
    - [x] Passengers: `getTransferVehiclePassengers`, `addTransferVehiclePassenger`, `removeTransferVehiclePassenger`, `updateTransferVehiclePassenger` (is_driver toggle)
    - [x] Realtime: `subscribeToVehicleRealtime`, `unsubscribeFromVehicleRealtime`
  - [x] **2.3 `packages/api/src/transferRentals.ts`**
    - [x] CRUD: `getTransferRentals` (ordered by pickup_date ASC NULLS LAST), `createTransferRental`, `updateTransferRental`, `softDeleteTransferRental`
    - [x] Realtime: `subscribeToRentalRealtime`, `unsubscribeFromRentalRealtime`
  - [x] **2.4 Export all from `packages/api/src/index.ts`**
  - [x] **2.5 Flight hooks (`apps/mobile/src/features/transfer/hooks/`)**
    - [x] `useTransferFlights.ts` — `useTransferFlights`, `useCreateTransferFlight`, `useUpdateTransferFlight`, `useDeleteTransferFlight`, `useBookTransferFlight`, `useCloseTransferFlightVoting`, `useReopenTransferFlightVoting`
    - [x] `useTransferFlightVotes.ts` — `useTransferFlightVotes`, `useCastTransferFlightVote` (optimistic update), `useRemoveTransferFlightVote`
    - [x] `useTransferFlightPassengers.ts` — `useTransferFlightPassengers`, `useSetTransferFlightPassengers`
    - [x] `useTransferFlightRealtime.ts` — realtime subscription with exponential backoff + AppState handling (pattern: `useAccommodationVotesRealtime.ts`)
  - [x] **2.6 Vehicle hooks (`apps/mobile/src/features/transfer/hooks/`)**
    - [x] `useTransferVehicles.ts` — CRUD hooks
    - [x] `useTransferVehiclePassengers.ts` — `useTransferVehiclePassengers`, `useAddTransferVehiclePassenger`, `useRemoveTransferVehiclePassenger`, `useUpdateTransferVehiclePassenger`
    - [x] `useTransferVehicleRealtime.ts` — realtime subscription
  - [x] **2.7 Rental hooks (`apps/mobile/src/features/transfer/hooks/`)**
    - [x] `useTransferRentals.ts` — CRUD hooks
    - [x] `useTransferRentalRealtime.ts` — realtime subscription
  - [x] **2.8 `apps/mobile/src/features/transfer/utils/flightWinner.ts`**
    - [x] `computeFlightWinner(flights, votesByFlightId)` → `{ outbound: string | null, return: string | null }`
    - [x] Per direction: filter closed flights, exclude any with group_blocker vote, score (must_do:5, like:4, open:3, skip:2, group_blocker:1), return highest-scoring ID
    - [x] Tie-break: most total votes → earliest created_at. Winner is UI-only — no DB column

- [x] **3. Components & Screens**
  - [x] **3.1 `TransferSegmentedControl.tsx`** — three segments (Flights | Vehicles | Rentals), pill-style matching the existing tab bar
  - [x] **3.2 `FlightCard.tsx`** — title, direction badge, airline + airports, times, price per person; vote section reusing `VoteSummary` + `VoteChip` from activities; vote border color; winner badge (green border + "Winner" label when isWinner && !voting_open); booking badge when status='booked' showing flight_number + booking_reference
  - [x] **3.3 `FlightCardWithVotes` wrapper** — wires `useTransferFlightVotes`, `useCastTransferFlightVote`, `useRemoveTransferFlightVote`; reuses `VoteSheet` from activities; expandable detail with notes, URL, and permission-gated buttons: Edit, End Voting, Re-open Voting, Book Flight, Manage Passengers, Delete
  - [x] **3.4 `BookFlightSheet.tsx`** — bottom sheet with flight_number + booking_reference inputs; uses `useBookTransferFlight`
  - [x] **3.5 `PassengerSelectSheet.tsx`** — generic reusable sheet: multi-select trip members with checkboxes; optional `showDriverToggle` prop for vehicle use (renders a driver toggle per selected member)
  - [x] **3.6 `CreateFlightSheet.tsx` / `EditFlightSheet.tsx`** — React Hook Form + Zod; fields: title, direction (segmented picker), airline, departure_airport, arrival_airport, departure_time + arrival_time (DateTimePicker), price_per_person, external_url, notes
  - [x] **3.7 `VehicleCard.tsx`** — title, direction badge, passenger names with driver indicator (steering wheel icon); no voting section
  - [x] **3.8 `VehicleCardWithPassengers` wrapper** — wires `useTransferVehiclePassengers`; expandable detail: notes, passenger list, Manage Passengers (opens `PassengerSelectSheet` with `showDriverToggle`), Edit, Delete
  - [x] **3.9 `CreateVehicleSheet.tsx` / `EditVehicleSheet.tsx`** — fields: title, direction, notes
  - [x] **3.10 `RentalCard.tsx`** — title, company, pickup/dropoff locations + dates, price, booking reference; no voting, no passengers; expandable detail with notes, URL, Edit, Delete
  - [x] **3.11 `CreateRentalSheet.tsx` / `EditRentalSheet.tsx`** — fields: title, company, pickup_location, dropoff_location, pickup_date + dropoff_date (DateTimePicker), booking_reference, price_total, external_url, notes
  - [x] **3.12 Empty states** — `EmptyFlights.tsx`, `EmptyVehicles.tsx`, `EmptyRentals.tsx`
  - [x] **3.13 `apps/mobile/app/trip/[id]/transfer.tsx`** — main Transfer tab screen
    - [x] `TransferSegmentedControl` at top; `activeSegment` state defaults to 'Flights'
    - [x] **Flights segment:** `useTransferFlights` + `useTransferFlightRealtime`; batch-fetch votes via `getTransferFlightVotesBatch`; `computeFlightWinner` util; `SectionList` with "Outbound" / "Return" sticky headers; `FlightCardWithVotes` per item; FAB → `CreateFlightSheet`
    - [x] **Vehicles segment:** `useTransferVehicles` + `useTransferVehicleRealtime`; `SectionList` with direction headers; `VehicleCardWithPassengers` per item; FAB → `CreateVehicleSheet`
    - [x] **Rentals segment:** `useTransferRentals` + `useTransferRentalRealtime`; `FlatList`; `RentalCard` per item; FAB → `CreateRentalSheet`
  - [x] **3.14 Register Transfer tab in `apps/mobile/app/trip/[id]/index.tsx`** *(note: file was `_layout.tsx` at Phase 7c time; restructured in Phase 8)*
    - [x] Add `'Transfer'` to TABS array between `'Base'` and `'Activities'`
    - [x] Import `TransferTab` from `./transfer`
    - [x] Add `case 'Transfer': return <TransferTab />;` in `renderTab()`

---

## 🔐 Phase 7d: Profile Settings — Encrypted Travel Documents & Organizer Access
*Dependencies: Phase 2 (Trips), Phase 1 (Auth)*
*Goal: Allow users to store encrypted passport/ID card details behind biometric authentication, and let trip organizers temporarily request access to members' documents for group bookings.*

- [x] **1. DB/RLS & Types**

  **Migration 1 — `20260525000001_enable_pgcrypto_and_vault_secret.sql`**

  - [x] `CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions`
  - [x] `CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault`
  - [x] Insert encryption key via `vault.create_secret()` (NOT direct INSERT — see docs/supabase.md)
  - [x] `private.get_travel_doc_encryption_key()` SECURITY DEFINER helper

  **Migration 2 — `20260525000002_create_user_travel_documents.sql`**

  - [x] `user_travel_documents` table: PII fields as BYTEA (AES-256 encrypted), country fields plaintext
  - [x] UNIQUE(user_id, document_type) — max one passport + one id_card per user
  - [x] RLS: SELECT = owner only; INSERT/UPDATE/DELETE = deny all (RPCs only)
  - [x] `upsert_travel_document(...)` RPC — SECURITY DEFINER, encrypts fields, upserts on conflict
  - [x] `get_my_travel_documents()` RPC — SECURITY DEFINER, decrypts and returns own documents
  - [x] `delete_travel_document(p_document_id)` RPC — SECURITY DEFINER

  **Migration 3 — `20260525000003_create_document_access_system.sql`**

  - [x] `document_access_requests` table + RLS (visible to trip members)
  - [x] `document_access_grants` table + RLS (visible to own user + organizer)
  - [x] `create_document_access_request(p_trip_id, p_duration_minutes)` — organizer only, 1 active per trip per 24h
  - [x] `respond_to_document_access_request(p_request_id, p_granted)` — member only, sets expires_at
  - [x] `get_my_pending_access_requests()` — returns unresponded requests with trip + requester info
  - [x] `get_accessible_member_documents(p_trip_id)` — organizer only, returns decrypted docs for active grants

  **Migration 4 — `20260525000004_profile_settings_security_fixes.sql`** (security hardening)

  - [x] `document_access_audit_log` table + RLS + auto-populated by `get_accessible_member_documents`
  - [x] Input validation in `upsert_travel_document`: ISO alpha-2 regex, date format regex, trim()
  - [x] Per-trip rate limit in `create_document_access_request`
  - [x] TOCTOU check in `respond_to_document_access_request` (reject requests > 24h old)
  - [x] `revoke_document_access(p_request_id)` RPC — member can revoke their own grant
  - [x] `get_my_active_grants()` RPC — returns currently active grants for caller

  **Types (`packages/types/`)**

  - [x] `DOCUMENT_TYPE = ['passport', 'id_card']` + `DocumentType` enum
  - [x] `ACCESS_REQUEST_DURATION = [15, 30, 60]` + `AccessRequestDuration` enum
  - [x] `TravelDocument`, `DocumentAccessRequest`, `AccessibleMemberDocument`, `ActiveGrant` interfaces
  - [x] `upsertTravelDocumentSchema`, `createDocumentAccessRequestSchema` Zod schemas
  - [x] `UpsertTravelDocumentInput`, `CreateDocumentAccessRequestInput` exported types

- [x] **2. Services & Hooks**

  **`packages/api/src/travelDocuments.ts`** (new file)

  - [x] `getMyTravelDocuments()` → `TravelDocument[]`
  - [x] `upsertTravelDocument(input)` → `string` (id)
  - [x] `deleteTravelDocument(documentId)` → `void`
  - [x] `createDocumentAccessRequest(tripId, durationMinutes)` → `string`
  - [x] `respondToDocumentAccessRequest(requestId, granted)` → `void`
  - [x] `getMyPendingAccessRequests()` → `DocumentAccessRequest[]`
  - [x] `getAccessibleMemberDocuments(tripId)` → `AccessibleMemberDocument[]`
  - [x] `revokeDocumentAccess(requestId)` → `void`
  - [x] `getMyActiveGrants()` → `ActiveGrant[]`
  - [x] All exported from `packages/api/src/index.ts`

  **`apps/mobile/src/features/profile/hooks/`** (all new)

  - [x] `useTravelDocuments.ts` — `staleTime: 0, gcTime: 0` (no caching for sensitive data), enabled only after biometric unlock
  - [x] `useUpsertTravelDocument.ts` — invalidates `['travelDocuments']`, success/error toasts
  - [x] `useDeleteTravelDocument.ts` — invalidates `['travelDocuments']`, success/error toasts
  - [x] `useUpdateProfile.ts` — calls `updateUserProfile`, syncs `authStore.setUser()`
  - [x] `useDocumentAccessRequests.ts` — `usePendingAccessRequests` (polls every 30s), `useRespondToAccessRequest`, `useActiveGrants` (polls every 60s), `useRevokeDocumentAccess`
  - [x] `useAccessibleMemberDocuments.ts` — `staleTime: 0, gcTime: 0`

- [x] **3. Components & Screens**

  **`apps/mobile/src/features/profile/components/`** (all new)

  - [x] `BiometricGate.tsx` — `expo-local-authentication` gate; shows locked placeholder until verified; shows Alert warning (with bypass) when device has no biometrics/PIN enrolled; locks on app background (AppState)
  - [x] `EditProfileSheet.tsx` — RHF + Zod; name, locale, timezone picker; pre-populated from user prop
  - [x] `TravelDocumentCard.tsx` — masked doc number, reveal tap, 30s auto-hide timer; flag emoji for country; expiry warning < 6 months; Edit + Delete buttons
  - [x] `AddTravelDocumentSheet.tsx` — document type picker, form fields; `zodResolver(upsertTravelDocumentSchema)`
  - [x] `EditTravelDocumentSheet.tsx` — pre-populated from document prop; `reset()` clears form on close
  - [x] `DocumentAccessRequestBanner.tsx` — expandable pending request list with Grant/Deny per entry
  - [x] `ActiveGrantsBanner.tsx` — shows member's active grants with expiry countdown and Revoke button
  - [x] `DocumentAccessRequestSheet.tsx` — organizer bottom sheet; duration picker (15/30/60 min); "Request Access" button
  - [x] `MemberDocumentsSheet.tsx` — organizer view of accessible member documents; grouped by member; shows time remaining

  **Profile screen: `apps/mobile/app/(tabs)/profile.tsx`** (new tab)

  - [x] Avatar + Name + Email header
  - [x] Edit Profile button → `EditProfileSheet`
  - [x] `DocumentAccessRequestBanner` (if pending requests)
  - [x] `ActiveGrantsBanner` (if active grants)
  - [x] Travel Documents section behind `BiometricGate`
  - [x] `TravelDocumentCard` per document + Add button for missing types
  - [x] AppState listener locks documents when app backgrounds
  - [x] Sign Out button with Alert confirmation
  - [x] Profile tab registered in `apps/mobile/app/(tabs)/_layout.tsx`

  **Trip Settings integration: `apps/mobile/app/trip/[id]/settings.tsx`**

  - [x] "Request Documents" section (organizer only) — opens `DocumentAccessRequestSheet`
  - [x] "View Documents" button (visible when active grants exist) — opens `MemberDocumentsSheet`

---

## 📝 Phase 7e: Trip Notes
*Dependencies: Phase 2 (Trips), Phase 1 (Auth)*
*Goal: Allow all trip members to create, edit, and delete free-text notes per trip. Organizers can delete any member's note.*

- [x] **1. DB/RLS & Types**

  **Migration — `20260525000005_create_trip_notes.sql`**

  - [x] `trip_notes` table: `id` UUID PK, `trip_id` FK→trips CASCADE, `created_by` FK→users, `title` TEXT(100) NOT NULL, `description` TEXT(1000) nullable, `created_at`, `updated_at` (trigger)
  - [x] `set_updated_at` BEFORE UPDATE trigger
  - [x] `restrict_trip_note_update_fields()` trigger — prevents changing `trip_id` or `created_by`
  - [x] Index on `trip_id`
  - [x] RLS SELECT: any trip member | INSERT: member + `created_by = auth.uid()` | UPDATE: note creator only | DELETE: note creator OR trip organizer

  **Types (`packages/types/`)**

  - [x] `TripNote` interface in `packages/types/src/database.ts`
  - [x] `createTripNoteSchema` (title min 1 / max 100, description max 1000 nullable optional)
  - [x] `updateTripNoteSchema` (all fields optional)
  - [x] `CreateTripNoteInput`, `UpdateTripNoteInput` exported types

- [x] **2. Services & Hooks**

  **`packages/api/src/notes.ts`** (new file)

  - [x] `getNotes(tripId)` — SELECT *, ordered by `created_at DESC`
  - [x] `createNote(tripId, input)` — resolves `created_by` from session, INSERT + `.select().single()`
  - [x] `updateNote(noteId, input)` — UPDATE + `.select().single()`
  - [x] `deleteNote(noteId)` — DELETE by `id`
  - [x] All exported from `packages/api/src/index.ts`

  **`apps/mobile/src/features/notes/hooks/useNotes.ts`** (new file)

  - [x] `useNotes(tripId)` — query key `['trips', tripId, 'notes']`, `retry: 2`, `enabled: !!tripId`
  - [x] `useCreateNote(tripId)` — invalidates notes list, success/error toasts
  - [x] `useUpdateNote(tripId)` — invalidates notes list, success/error toasts
  - [x] `useDeleteNote(tripId)` — invalidates notes list, success/error toasts

- [x] **3. Components & Screens**

  **`apps/mobile/src/features/notes/components/`** (all new)

  - [x] `EmptyNotes.tsx` — empty state illustration/text
  - [x] `NoteCard.tsx` — displays title, description, author name, timestamps; `onPress` opens edit sheet
  - [x] `CreateNoteSheet.tsx` — RHF + Zod; title + description fields; `isPending` guard
  - [x] `EditNoteSheet.tsx` — pre-populated form; Delete button shown only to creator or organizer (`canDelete` prop); `isUpdatePending` / `isDeletePending` guards

  **`apps/mobile/app/trip/[id]/notes.tsx`** (new screen)

  - [x] `useNotes`, `useCreateNote`, `useUpdateNote`, `useDeleteNote` wired
  - [x] `useTripMembers` + `useCurrentMemberRole` for author name map and organizer check
  - [x] Loading spinner while `isLoading`; `EmptyNotes` when list is empty; `FlatList` otherwise
  - [x] FAB (bottom-right, primary color) → `CreateNoteSheet`
  - [x] `NoteCard` `onPress` → `EditNoteSheet`; delete clears `editingNote` state on success
  - [x] `canDelete`: creator OR organizer; no realtime (notes are low-frequency, polling not needed)

  **`apps/mobile/app/trip/[id]/index.tsx`** *(was `_layout.tsx` at Phase 7e time; restructured in Phase 8)*

  - [x] `'Notes'` added to TABS array (between `'Recipes'` and `'Settings'`)
  - [x] `NotesTab` imported and returned in `renderTab()` switch

---

## 🔔 Phase 8: Notifications
*Dependencies: Phases 3, 4a, 4b, 5a, 5b & 5c*
*Goal: In-app notification center + Expo push notifications with per-trip preference controls.*

**Architecture decisions:**
- In-app notifications: DB triggers create rows in `notifications` table; polled by TanStack Query (30s interval, no realtime channel)
- Push notifications: Supabase Edge Function called via `pg_net` AFTER INSERT trigger on `notifications` (fire-and-forget)
- Notification preferences: control push delivery only — in-app always visible
- No per-vote notifications; `vote_finalized` only (anti-spam)

- [x] **1. DB/RLS & Types**

  **Migration: `20260522213020_create_push_tokens`**
  - [x] `user_push_tokens` table: `id`, `user_id` FK→users CASCADE, `push_token TEXT`, `platform TEXT CHECK('ios','android')`, timestamps, `UNIQUE(user_id, push_token)`
  - [x] RLS: own rows only for SELECT/INSERT/UPDATE/DELETE
  - [x] `upsert_push_token(p_push_token, p_platform)` SECURITY DEFINER RPC
  - [x] `delete_push_token(p_push_token)` SECURITY DEFINER RPC

  **Migration: `20260522213020_create_notifications`**
  - [x] `notifications` table: `id`, `trip_id` FK→trips CASCADE, `user_id` FK→users CASCADE (recipient), `type TEXT CHECK(8 types including 'document_access_request')`, `title`, `body` nullable, `related_type`, `related_id`, `is_read BOOLEAN DEFAULT FALSE`, `push_sent_at TIMESTAMPTZ DEFAULT NULL`, `created_at`
  - [x] `restrict_notification_update_fields()` trigger — only `is_read` and `push_sent_at` may be changed
  - [x] RLS: SELECT/UPDATE/DELETE own rows; INSERT `WITH CHECK (false)` (all writes via SECURITY DEFINER)
  - [x] `mark_notification_read(p_notification_id UUID)` SECURITY DEFINER RPC
  - [x] `mark_all_notifications_read(p_trip_id UUID DEFAULT NULL)` SECURITY DEFINER RPC
  - [x] `get_unread_notification_count(p_trip_id UUID DEFAULT NULL)` SECURITY DEFINER STABLE RPC
  - [x] Indexes: `(user_id, is_read, created_at DESC)`, `(trip_id, user_id, created_at DESC)`

  **Migration: `20260522213021_create_notification_preferences`**
  - [x] `notification_preferences` table: `id`, `user_id` FK→users CASCADE, `trip_id` FK→trips CASCADE, 6 boolean columns all `DEFAULT TRUE`, `UNIQUE(user_id, trip_id)`
  - [x] INSERT blocked by RLS; auto-created via `auto_create_notification_preferences()` SECURITY DEFINER trigger AFTER INSERT on `trip_members`
  - [x] RLS: SELECT/UPDATE own rows only

  **Migration: `20260522213021_create_notification_helpers`**
  - [x] `private.create_trip_notification(p_trip_id, p_exclude_user_id, p_type, p_title, p_body, p_related_type, p_related_id)` SECURITY DEFINER — loops over `trip_members`, inserts one notification row per member (each INSERT fires push trigger)
  - [x] `send_organizer_nudge(p_trip_id, p_title, p_body)` SECURITY DEFINER — organizer only, rate-limited to 3 nudges/hour per trip, type=`'reminder'`

  **Migration: `20260522213022_create_notification_push_trigger`**
  - [x] `CREATE EXTENSION IF NOT EXISTS pg_net`
  - [x] Vault secrets stored via `vault.create_secret()` (Edge Function URL + service_role_key)
  - [x] `private.dispatch_push_notification()` AFTER INSERT on `notifications` FOR EACH ROW — reads vault secrets, calls `net.http_post()` fire-and-forget

  **Migration: `20260522213022_create_notification_event_triggers`**
  - [x] `notify_new_activity` — AFTER INSERT on `activities` → type `new_activity`, excludes `created_by`
  - [x] `notify_new_expense` — AFTER INSERT on `expenses` → type `expense_change`, excludes `created_by`
  - [x] `notify_new_member` — AFTER INSERT on `trip_members` → type `new_member`, excludes `user_id`
  - [x] `notify_activity_vote_finalized` — AFTER UPDATE WHERE `OLD.voting_open AND NOT NEW.voting_open` on `activities` → type `vote_finalized`, notifies all members
  - [x] `notify_accommodation_vote_finalized` — same pattern on `accommodations`
  - [x] `notify_schedule_change` — AFTER UPDATE on `activities` WHERE date/time fields changed → type `schedule_change`, excludes `auth.uid()`, guarded by `pg_trigger_depth() > 1`
  - [x] `notify_document_access_request` — AFTER INSERT on `document_access_requests` → type `document_access_request`, notifies organizer (recipient), excludes `requested_by`

  **Types**
  - [x] `packages/types/src/enums.ts` — added `'document_access_request'` to `NOTIFICATION_TYPE` (now 8 types)
  - [x] `packages/types/src/database.ts` — added `UserPushToken` interface; added `push_sent_at: string | null` to `Notification`
  - [x] `packages/types/src/schemas.ts` — added `updateNotificationPreferencesSchema` (6 optional booleans) + `UpdateNotificationPreferencesInput`
  - [x] `packages/types/src/notifications.ts` (new) — `NudgeMessage` interface + `NUDGE_MESSAGES` array (8 predefined playful nudge messages)
  - [x] `packages/types/src/index.ts` — exports `./notifications`
  - [x] `packages/api/src/database.types.ts` — regenerated from remote project to include new tables and RPCs

- [x] **2. Services & Hooks**

  **Edge Function: `supabase/functions/push-notification/index.ts`**
  - [x] Auth: validates `Authorization: Bearer <service_role_key>` header
  - [x] Checks `notification_preferences` for user/trip; maps type → preference column; skips push if pref is `false` (in-app notification still exists)
  - [x] Fetches `user_push_tokens` for recipient; sends to `https://exp.host/--/api/v2/push/send`
  - [x] Includes `data: { notificationId, tripId, type, relatedType, relatedId }` for deep-link tap handling
  - [x] On `DeviceNotRegistered` ticket error: deletes stale token from `user_push_tokens`
  - [x] Updates `push_sent_at` on success
  - [x] `document_access_request` type is always-on (no preference column gate)

  **`packages/api/src/notifications.ts`** (new)
  - [x] `getNotifications(limit=50)`, `getTripNotifications(tripId, limit=50)`, `getUnreadCount(tripId?)`, `markNotificationRead(id)`, `markAllNotificationsRead(tripId?)`, `deleteNotification(id)`, `getNotificationPreferences(tripId)`, `updateNotificationPreferences(tripId, prefs)`, `sendOrganizerNudge(tripId, title, body)`

  **`packages/api/src/pushTokens.ts`** (new)
  - [x] `upsertPushToken(token, platform)`, `deletePushToken(token)`
  - [x] Both exported from `packages/api/src/index.ts`

  **Expo Notifications SDK**
  - [x] `expo-notifications`, `expo-device`, `expo-constants` installed
  - [x] `expo-notifications` plugin added to `apps/mobile/app.config.ts` with `color: '#6C63FF'`, `defaultChannel: 'default'`

  **`apps/mobile/src/features/notifications/utils/registerForPushNotifications.ts`**
  - [x] Checks `Device.isDevice`, requests permissions, gets Expo push token (projectId `a1dc4172-7c41-4aa9-a44d-afb1a0088278`), calls `upsertPushToken`, sets Android notification channel

  **`apps/mobile/src/features/notifications/utils/resolveNotificationPath.ts`**
  - [x] Shared util used by all 3 navigation paths (screens + push tap handler)
  - [x] Accepts `Pick<Notification, 'type' | 'trip_id' | 'related_type'>`
  - [x] `vote_finalized` / `vote_update`: routes to `?tab=Base` for `related_type === 'accommodation'`, `?tab=Activities` otherwise
  - [x] `new_activity` / `schedule_change` → `?tab=Activities`; `expense_change` → `?tab=Expenses`; `new_member` → `?tab=Settings`; `reminder` → trip root; `document_access_request` → `/(tabs)/profile`

  **Hooks**
  - [x] `useNotifications.ts` — `useNotifications`, `useTripNotifications` (30s poll each), `useMarkNotificationRead`, `useMarkAllNotificationsRead`, `useDeleteNotification` (optimistic removal + rollback)
  - [x] `useUnreadCount.ts` — `useUnreadCount`, `useTripUnreadCount` (30s poll each; used for badge display)
  - [x] `useNotificationPreferences.ts` — `useNotificationPreferences`, `useUpdateNotificationPreferences` (optimistic toggle)
  - [x] `useSendNudge.ts` — rate-limit-aware error message, success toast
  - [x] `usePushNotificationHandler.ts` — `addNotificationResponseReceivedListener` for tap deep-linking; extracts `type`, `tripId`, `relatedType` from push payload data; calls `resolveNotificationPath`

  **Auth store + sign-out**
  - [x] `apps/mobile/src/stores/authStore.ts` — added `pushToken: string | null` + `setPushToken` action
  - [x] `apps/mobile/src/features/auth/hooks/useSignOut.ts` — calls `deletePushToken(pushToken)` BEFORE `signOut()` while session is still valid (prevents ghost pushes)

  **Root layout `apps/mobile/app/_layout.tsx`**
  - [x] `Notifications.setNotificationHandler` at module level
  - [x] `registerForPushNotificationsAsync()` called after `hasSession && userId` confirmed; result stored via `setPushToken`
  - [x] `usePushNotificationHandler()` mounted globally

- [x] **3. Components & Screens**

  **Components**
  - [x] `NotificationItem.tsx` — icon by type, bold title if unread, unread dot (right side, `bg-danger`), `dayjs().fromNow()` timestamp; `onPress` marks read + navigates
  - [x] `EmptyNotifications.tsx` — standard empty state
  - [x] `NotificationPreferencesSection.tsx` — 6 Switch toggles (new activities, vote results, expense updates, new members, schedule changes, reminders & nudges); optimistic updates
  - [x] `NudgeSheet.tsx` — Modal with FlatList of `NUDGE_MESSAGES`; `useSendNudge`; closes on success
  - [x] `TripNotificationBell.tsx` — `notifications-outline` icon; badge dot `bg-danger` (red) when unread count > 0; navigates to `/trip/${tripId}/notifications`

  **Screens**
  - [x] `apps/mobile/app/(tabs)/notifications.tsx` — Global notification center (4th tab); `useNotifications`; FlatList + pull-to-refresh; "Mark all as read" button; `EmptyNotifications` empty state; uses `resolveNotificationPath`
  - [x] `apps/mobile/app/trip/[id]/notifications.tsx` — Per-trip notification screen; `useTripNotifications`; back button (`router.back()`); `SafeAreaView`; same list pattern as global

  **Integration**
  - [x] `apps/mobile/app/(tabs)/_layout.tsx` — 4th Notifications tab with `useUnreadCount` badge (`backgroundColor: '#FF3B30'` red)
  - [x] `apps/mobile/app/trip/[id]/index.tsx` — `<TripNotificationBell tripId={id!} />` in trip header
  - [x] `apps/mobile/app/trip/[id]/settings.tsx` — `NotificationPreferencesSection` + `NudgeSheet` (organizer only, `Platform.OS !== 'web'` guards)

  **Routing fix: `apps/mobile/app/trip/[id]/` restructure**
  - [x] Root cause: `[id]/_layout.tsx` was a custom component with no `<Stack>`/`<Slot>`, making `notifications.tsx` unreachable as a pushed route — the bell Pressable appeared unresponsive because `router.push` failed before press animation committed
  - [x] `apps/mobile/app/trip/[id]/_layout.tsx` → replaced with `<Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />`
  - [x] `apps/mobile/app/trip/[id]/index.tsx` → now contains the full custom trip UI (formerly in `_layout.tsx`)
  - [x] `apps/mobile/app/trip/[id]/overview.tsx` (new) → the former `index.tsx` OverviewTab component
  - [x] `notifications.tsx` is now a proper Stack screen; back button navigates with `router.back()`

---

## ✨ Phase 9: Polish & Hardening
*Dependencies: All previous phases*
*Goal: Production & legal readiness; Google Play Store.*

- [x] **1. UI/UX Polish**
  - [x] Implement Skeleton Screens — `TripListSkeleton`, `ActivityListSkeleton`, `ExpenseListSkeleton`, `NotificationListSkeleton`; `Skeleton` base component in `@vacationist/ui` with reanimated shimmer; `LoadingScreen`, `FloatingActionButton`, `EmptyState` shared components; primary screens now show skeletons instead of `ActivityIndicator`
  - [x] Finalize Guest upgrade flow UI — `GuestUpgradeBanner` + `GuestUpgradeSheet` (Google + Magic Link options); `useGuestUpgrade` hook; `linkGuestWithGoogle` / `linkGuestWithMagicLink` API functions; shown on profile screen when `isGuest(user)` is true
  - [x] Extract hardcoded colors to `packages/ui/src/theme.ts` — `colors.*` constants, replaced across all app files
- [x] **2. Security & Performance**
  - [x] Conduct full RLS audit on all tables — all 29 tables clean, no fixes required
  - [x] Enable `manual_linking` in `supabase/config.toml` (required for guest upgrade flow)
  - [x] Implement vote rate limiting — `check_vote_rate_limit()` SECURITY DEFINER trigger; 60 votes/hour per user per trip across `activity_votes`, `accommodation_votes`, `transfer_flight_votes`; migration `20260523120000_vote_rate_limit.sql`
  - [x] Implement list virtualization — `@shopify/flash-list@2.3.1` installed; FlatList → FlashList in 9 screens (index, notifications ×2, accommodations, notes, recipes, shopping-list, recipe detail, transfer rentals); SectionList perf props (`windowSize=5`, `maxToRenderPerBatch=10`, `initialNumToRender=10`) added to 4 screens (activities, expenses, shopping, transfer); pull-to-refresh added to all 9 screens that were missing it
- [x] **3. DevOps**
  - [x] Configure Expo EAS build profiles — root `eas.json` consolidated; channels, Android AAB, submit config; stale `apps/mobile/eas.json` deleted
  - [x] Crash reporting — Sentry (`@sentry/react-native`) wired into `_layout.tsx`, both error boundaries, `app.config.ts` plugin; disabled in dev
  - [x] Fix splash screen & adaptive icon background (`#ffffff` → `#0F0F0F`)
  - [x] Setup OTA updates — `expo-updates` installed; `updateChecker.ts` checks on app foreground via `AppState`; `app.config.ts` has `runtimeVersion.policy: 'fingerprint'`, `updates.url`, and `expo-updates` plugin
  - [x] Production database, triggers, edge functions, app deployment, Firebase Cloud Messaging API (V1), expo.prd, OAuth (Google), Resend custom domain etc.
- [x] *4. Third-party style guidelines*
  - [x] Sign in with Google Branding — `GoogleSignInButton` component in `@vacationist/ui`; dark `#131314` background, white text, Ionicons `logo-google`, 4dp border radius, 48dp height; replaces generic purple `<Button>` in `login.tsx`
  - [x] Scan the code base for other relevant guidelines and fulfil them
- [x] *5. Prepare Google Play Store release*
  - [x] Technical details — `expo-build-properties` installed; `targetSdkVersion: 36`, `compileSdkVersion: 36` in `app.config.ts` (exceeds Play Store 2025 minimum of 35)
  - [x] `push-notification` Edge Function deployed to prod (`fsfsqghbejwvgxujoyne`); simplified auth uses `SUPABASE_SERVICE_ROLE_KEY` (auto-injected); vault secrets `push_notification_edge_fn_url` and `push_notification_service_role_key` both set in prod
  - [x] EAS Submit & Release Pipeline — already configured
  - [x] Google Play Console Assets — app icon 512×512 (`play-store/icon.png`), feature graphic 1024×500 (`play-store/feature-graphic.png`), 4 screenshot HTML mockups (`play-store/screenshots/`), store listing text (`play-store/listing.md`); **manual step remaining**: take actual device screenshots from HTML mockups (Chrome DevTools 390×844), upload to Play Console
  - [x] Compliance & Policy — Privacy Policy (`docs/privacy-policy.html`, Swiss nDSG + GDPR, hosted on GitHub Pages); Terms of Service (`docs/terms-of-service.html`, Swiss OR); Landing page (`docs/home.html`)
  - [x] Release Strategy — documented in `docs/CLAUDE.md`: version numbering (MAJOR.MINOR.PATCH), EAS channels & build profiles, OTA rules, staged rollout (10%→50%→100%), hotfix process, pre-release checklist, monitoring table, key IDs reference

## 🌐 Phase 10: Landing Page / Marketing Website (GitHub Pages)
*Dependencies: Phase 9*
*Goal: Create a polished, responsive, mobile-first landing page for Vacationist.*
*Hosting: GitHub Pages from `docs/` folder on `main` branch at `vacationist.app`.*

- [x] **1. Content**
  - [x] Explains the product clearly within seconds (`docs/index.html` hero section)
  - [x] Showcases the core features visually (6-card features grid)
  - [x] Demonstrates the collaborative vacation planning workflow (How it works section)
  - [x] Provides a QR code + Play Store link for mobile onboarding (Download section)
  - [x] App Store "Coming Soon" badge (iOS version planned)
  - [x] Switzerland impressum for a private person — Nebenerwerbstätigkeit (`docs/impressum.html`)
  - [x] Establishes modern product identity and trust (trust strip, brand colors)
  - [x] SEO: meta tags, OG, Twitter Card, JSON-LD, `robots.txt`, `sitemap.xml`
- [x] **2. Pure marketing/onboarding — no actual web app implemented**
  - [x] Marketing & product presentation only
  - [x] App distribution entry points (Play Store links + QR code)
- [x] **3. Landing page feeling**
  - [x] Modern & lightweight (pure HTML/CSS/JS, no framework)
  - [x] Premium & fast (CSS-only animations, no runtime dependencies)
  - [x] Social & collaborative (floating activity chips, vote previews in phone mockup)
  - [x] Travel-oriented (flag emojis, trip cards, destination themes)
- [x] **4. Avoided**
  - [x] No enterprise/SaaS aesthetics
  - [x] No AI buzzword marketing
  - [x] No feature overload
  - [x] No pricing section
- [x] **5. Files created/updated**
  - [x] `docs/index.html` — full landing page (replaces `docs/home.html`)
  - [x] `docs/impressum.html` — Swiss legal impressum (new)
  - [x] `docs/privacy-policy.html` — fixed placeholder emails, added nav, Inter font
  - [x] `docs/terms-of-service.html` — added nav, Inter font
  - [x] `docs/robots.txt` — SEO crawler config
  - [x] `docs/sitemap.xml` — all pages listed
  - [x] `docs/404.html` — custom 404 matching brand
  - [x] `docs/home.html` — **delete** (replaced by index.html)

**Hosting setup (GitHub Pages):**
- In repo Settings → Pages → Source: Deploy from branch `main`, folder `/docs`
- Add `docs/CNAME` with content `vacationist.app` (if using custom domain)

**Cloudflare DNS (for custom domain vacationist.app):**
- `A` records pointing to GitHub Pages IPs:
  - `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
- OR `CNAME www → <username>.github.io` (proxy off for GitHub Pages to work)
- The Resend DKIM/SPF records for custom email domain also go here when configured.

**Note:** Firebase App Hosting removed from scope — GitHub Pages is sufficient for a static marketing site. A web app (React Native Web or Next.js) can be added to `apps/web/` in a future phase if needed.
