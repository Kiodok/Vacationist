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
  - [x] Insert encryption key via `vault.create_secret()` (NOT direct INSERT — see engineering/supabase.md)
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
  - [x] Release Strategy — documented in `engineering/CLAUDE.md`: version numbering (MAJOR.MINOR.PATCH), EAS channels & build profiles, OTA rules, staged rollout (10%→50%→100%), hotfix process, pre-release checklist, monitoring table, key IDs reference

## 🌐 Phase 10: Landing Page / Marketing Website (GitHub Pages)
*Dependencies: Phase 9*
*Goal: Create a polished, responsive, mobile-first landing page for Vacationist.*
*Hosting: GitHub Pages from `docs/` folder on `main` branch at `vacationist.app`.*

- [x] **1. Content**
  - [x] Explains the product clearly within seconds (`docs/index.html` hero section)
  - [x] Showcases the core features visually (6-card features grid)
  - [x] Demonstrates the collaborative vacation planning workflow (How it works section)
  - [x] Provides a QR code + Play Store link for mobile onboarding (Download section)
  - [x] ~~App Store "Coming Soon" badge (iOS version planned)~~ — superseded by Phase 16: iOS shipped, badge is now a live App Store link
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

---

## 💳 Phase 11: Monetization — Trip-Day Model
*Dependencies: Phase 9 (Polish & Hardening)*
*Goal: Freemium model gated on trip-days, feature depth, and member count. Participants always join for free.*
*Trigger: Ship when MAU reaches ~500. Estimated 2 days of work.*

---

### Business Rules

#### Free Tier
- **Day quota:** 15 trip-days per calendar year (resets 1 January). Each trip created by the organizer consumes `end_date − start_date + 1` days at creation time.
- **Trip duration:** Max 14 days per trip.
- **Date shifting:** A free trip's start date may only move ±7 days from `original_start_date` (stored at creation, never mutated). Prevents cycling a short trip through the entire year.
- **Members:** Max 4 per trip (organizer + 3 participants). Enforced at join time; existing members are never removed when Pro expires.
- **Features locked on free trips:**
  - Expenses tab: hidden, replaced by "Get Pro to unlock" prompt
  - Prework tab: hidden, replaced by "Get Pro to unlock" prompt
  - Transfers — Flights: not available, replaced by "Get Pro to unlock" prompt
  - Transfers — Vehicles & Rentals: max 1 vehicle AND max 1 rental per trip (earliest by `created_at`; extras hidden)

#### Pro Tier (€2.99/mo or €24.99/yr)
- Unlimited trip-days (day quota not tracked for Pro users)
- Unlimited trip duration
- Unlimited members per trip — no enforced cap (PostgreSQL imposes no row limit; FlashList handles large member lists via virtualization)
- All features unlocked
- Trips created while Pro is active are marked `created_with_pro = TRUE`

#### Pro Expiry Behaviour
When a Pro subscription expires (`is_pro` becomes `FALSE`):
- **Pro-created trips** (`created_with_pro = TRUE`) become inaccessible — shown with a "Get Pro to unlock your trip" placeholder. Data is fully preserved; reactivating Pro instantly restores access.
- **All free trips** (`created_with_pro = FALSE`) remain visible and editable — these were created under free tier rules and are unaffected by Pro expiry. Only trips with `created_with_pro = TRUE` become inaccessible.
- Feature scope reverts to Free tier:
  - Expenses tab hidden (data preserved)
  - Prework tab hidden (data preserved)
  - Flights hidden in Transfers tab (data preserved, reappears on reactivation)
  - Vehicles: only the first created vehicle visible per trip; extras hidden (reappear on reactivation)
  - Rentals: same pattern as vehicles
- **No data is ever deleted.** All Pro content is restored exactly as-left upon reactivation.

#### Anti-Gaming Rules
These rules make day-based gating abuse-resistant:
- Day consumption is **permanent**. Soft-deleting or archiving a trip does **not** return its days.
- Extending a free trip's end date consumes additional days from the annual quota; shortening does not return days.
- Free trip duration is hard-capped at 14 days regardless of remaining annual quota — prevents the "one giant trip" workaround.
- The ±7 day shift limit on free trips prevents the "create short trip, slide it through the whole year" workaround.

---

**Payment stack:** RevenueCat (`react-native-purchases`) wraps Google Play Billing. You never handle card data. RevenueCat free tier covers up to $2,500 MRR. Google takes 15% (reduced rate, Developer Program). RevenueCat webhooks update Supabase when subscription status changes.

---

- [ ] **1. DB/RLS & Types**

  **Migration — `YYYYMMDDHHMMSS_add_monetization_to_users.sql`**

  - [ ] `ALTER TABLE public.users ADD COLUMN is_pro BOOLEAN NOT NULL DEFAULT FALSE`
  - [ ] `ALTER TABLE public.users ADD COLUMN pro_expires_at TIMESTAMPTZ DEFAULT NULL` — set when subscription lapses; used by client to detect expiry state
  - [ ] `ALTER TABLE public.users ADD COLUMN annual_days_used INT NOT NULL DEFAULT 0` — resets on calendar year boundary (checked on read, reset lazily)
  - [ ] `ALTER TABLE public.users ADD COLUMN annual_days_year INT NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::INT`
  - [ ] Index on `(id, is_pro)` for fast paywall checks
  - [ ] `update_user_pro_status(p_user_id UUID, p_is_pro BOOLEAN, p_expires_at TIMESTAMPTZ)` SECURITY DEFINER RPC — called by webhook Edge Function only; validates caller is `service_role`
  - [ ] `check_and_consume_trip_days(p_user_id UUID, p_days INT) RETURNS BOOLEAN` SECURITY DEFINER RPC — atomically resets annual counter if `annual_days_year != current year`, checks `(15 - annual_days_used) >= p_days`, deducts if sufficient and returns TRUE; returns FALSE if insufficient (caller opens PaywallSheet)

  **Migration — `YYYYMMDDHHMMSS_add_monetization_to_trips.sql`**

  - [ ] `ALTER TABLE public.trips ADD COLUMN created_with_pro BOOLEAN NOT NULL DEFAULT TRUE`
  - [ ] `ALTER TABLE public.trips ADD COLUMN original_start_date DATE DEFAULT NULL` — set at creation, never mutated; enforces ±7 day shift limit for free trips
  - [ ] `ALTER TABLE public.trips ADD COLUMN max_members INT DEFAULT NULL` — NULL for Pro trips, 4 for free trips
  - [ ] Index on `(created_by, created_with_pro, deleted_at)`

  **Types (`packages/types/`)**

  - [ ] Add `is_pro: boolean`, `pro_expires_at: string | null`, `annual_days_used: number`, `annual_days_year: number` to `User` interface in `packages/types/src/database.ts`
  - [ ] Add `created_with_pro: boolean`, `original_start_date: string | null`, `max_members: number | null` to `Trip` interface
  - [ ] Add constants to `packages/types/src/constants.ts`:
    - `FREE_TRIP_MAX_DAYS = 14`
    - `FREE_TRIP_MAX_MEMBERS = 4`
    - `FREE_TRIP_DATE_SHIFT_DAYS = 7`
    - `FREE_ANNUAL_DAYS = 15`

- [ ] **2. Services & Hooks**

  **Edge Function: `supabase/functions/revenue-cat-webhook/index.ts`**

  - [ ] Validate RevenueCat webhook `Authorization` header (shared secret in Vault, same pattern as push-notification function)
  - [ ] Handle `INITIAL_PURCHASE`, `RENEWAL`, `PRODUCT_CHANGE` → call `update_user_pro_status(userId, TRUE, NULL)`
  - [ ] Handle `CANCELLATION`, `EXPIRATION`, `BILLING_ISSUE` → call `update_user_pro_status(userId, FALSE, NOW())`; then insert a row into `public.notifications` with `type: 'pro_expired'` and body "Your Pro subscription has expired. Trips created with Pro are now locked — reactivate to restore access." (triggers the existing push notification pipeline)
  - [ ] Return `200` on success, `400` on unknown event (never `500` — RevenueCat retries on 5xx)
  - [ ] Store RevenueCat webhook secret in Vault via `vault.create_secret()`

  **`packages/api/src/subscriptions.ts`** (new file)

  - [ ] `getAnnualDayStatus(userId)` — fetches `annual_days_used` and `annual_days_year` from users; returns `{ daysUsed, daysRemaining: max(0, 15 - daysUsed) }`. If `annual_days_year != current year` the display value treats `daysUsed` as 0 (full quota available) — the actual DB counter reset is performed atomically by `check_and_consume_trip_days`, not client-side
  - [ ] `initRevenueCat(userId)` — `Purchases.configure({ apiKey: EXPO_PUBLIC_REVENUECAT_API_KEY, appUserID: userId })`; call once after session confirmed
  - [ ] `getProEntitlement()` — current entitlement from RevenueCat SDK (source of truth for UI gating)
  - [ ] `getOfferings()` — fetches RevenueCat offerings (monthly + annual subscription packages)
  - [ ] `purchasePro(pkg)` — `Purchases.purchasePackage(pkg)`; returns updated `CustomerInfo`
  - [ ] `restorePurchases()` — `Purchases.restorePurchases()`
  - [ ] All exported from `packages/api/src/index.ts`

  **Hooks (`apps/mobile/src/features/subscription/hooks/`)**

  - [ ] `useProStatus.ts` — `useQuery` on `getProEntitlement()`; query key `['proStatus']`; `staleTime: 60_000`; returns `{ isPro, isLoading }`
  - [ ] `useAnnualDayStatus.ts` — `useQuery` on `getAnnualDayStatus`; query key `['annualDayStatus']`; returns `{ daysUsed, daysRemaining }`
  - [ ] `usePurchasePro.ts` — `useMutation` wrapping `purchasePro(pkg)`; on success: invalidates `['proStatus']`, calls `authStore.setUser({ is_pro: true })`; `PURCHASE_CANCELLED` swallowed silently — no toast
  - [ ] `useRestorePurchases.ts` — `useMutation`; success toast "Purchases restored"; invalidates `['proStatus']`

  **Trip creation gate (modify existing `useCreateTrip` flow)**

  - [ ] Before opening `CreateTripSheet`, resolve `daysNeeded = end_date − start_date + 1` and check:
    ```
    if isPro                              → allowed, proceed
    elif daysNeeded <= daysRemaining      → call check_and_consume_trip_days RPC, proceed
    else                                  → open PaywallSheet with { context: 'trip_creation' }
    ```
  - [ ] After successful trip creation on the free tier, invalidate `['annualDayStatus']` query so the profile screen and date picker reflect the updated remaining days immediately
  - [ ] In `CreateTripSheet` form: if `!isPro`, clamp max duration picker to `FREE_TRIP_MAX_DAYS` (14 days) and show "X days remaining this year" below the date picker
  - [ ] Set `created_with_pro = isPro` and `original_start_date = start_date` on trip creation payload
  - [ ] Set `max_members = isPro ? null : FREE_TRIP_MAX_MEMBERS` on trip creation payload

  **Trip date-edit gate (modify `updateTrip` flow)**

  - [ ] For free trips (`created_with_pro = false`):
    - Validate `|new_start_date − original_start_date| ≤ FREE_TRIP_DATE_SHIFT_DAYS` — block with toast if violated
    - Validate `new_duration ≤ FREE_TRIP_MAX_DAYS` — block with toast if violated
    - If `new_duration > old_duration`: call `check_and_consume_trip_days(extra_days)` — if RPC returns FALSE, block with toast "Not enough days remaining this year" + "Upgrade to Pro" action

  **Member join gate (modify invite acceptance flow)**

  - [ ] Before adding member to trip: if `trip.max_members != null && currentMemberCount >= trip.max_members` → block with message "This trip is full (free tier limit: 4 members). Ask the organizer to upgrade to Pro."

  **Pro expiry visibility (modify existing query hooks — client-side only, no RLS changes)**

  - [ ] `useExpenses`, `usePreworkPreferences`: when `!isPro` → skip fetch, return locked state
  - [ ] `useTransferFlights`: when `!isPro` → skip fetch, return `[]` with `isLocked: true`
  - [ ] `useTransferVehicles`: when `!isPro` → fetch all ordered by `created_at ASC`, return only `[data[0]]` with `lockedCount = data.length - 1`
  - [ ] `useTransferRentals`: same pattern as vehicles (ordered by `created_at ASC`)
  - [ ] All locked states pass `isLocked: true` and `lockedCount: number` for UI rendering

- [ ] **3. Components & Screens**

  **`apps/mobile/src/features/subscription/components/PaywallSheet.tsx`**

  - [ ] Bottom sheet (reuse existing `BottomSheet`); opened from: trip creation limit, locked tab tap, locked Pro trip, member join block
  - [ ] Context-aware header driven by `context` prop: `'trip_creation'` → "Unlock More Trips", `'locked_trip'` → "Unlock Your Trip", `'locked_feature'` → "Unlock [feature name]"
  - [ ] Value props (4 bullets): "Unlimited trip length", "Expenses, transfers & prework", "Up to unlimited group members", "Support solo development"
  - [ ] Price section: annual option (highlighted "Best value · €24.99/yr") + monthly option (€2.99/mo); fetched from `getOfferings()`
  - [ ] Primary CTA: "Continue with Annual · €24.99/yr"; secondary: "Monthly · €2.99/mo"
  - [ ] "Restore Purchases" ghost button at bottom
  - [ ] Legal footnote: subscription auto-renews, cancel via Play Store
  - [ ] `isPending` guard on both purchase buttons

  **`apps/mobile/src/features/subscription/components/ProBadge.tsx`**
  - [ ] Small pill `bg-primary/20 text-primary` showing "Pro" — next to user name on profile screen when `isPro`

  **`apps/mobile/src/features/subscription/components/ManageSubscriptionRow.tsx`**
  - [ ] Visible to Pro users only; opens `Linking.openURL('https://play.google.com/store/account/subscriptions')`

  **`apps/mobile/src/features/subscription/components/LockedFeaturePlaceholder.tsx`** (new)
  - [ ] Used inside Expenses, Prework, and Transfers (flights segment) when feature is locked
  - [ ] Props: `feature: string`, `variant: 'upgrade' | 'reactivate'`, `onUpgrade: () => void`
  - [ ] `'upgrade'` variant: user never had Pro → button label "Upgrade to Pro"
  - [ ] `'reactivate'` variant: Pro expired, feature was previously accessible → button label "Reactivate Pro"
  - [ ] Shows lock icon, one-line feature description, context-appropriate CTA button
  - [ ] Consistent with the existing `EmptyState` component's layout

  **`apps/mobile/src/features/subscription/components/LockedTripCard.tsx`** (new)
  - [ ] Shown in the trip list for Pro-created trips when `!isPro`
  - [ ] Displays trip title + date range (data still readable for display purposes) with a lock overlay
  - [ ] "Get Pro to unlock" label; tapping opens `PaywallSheet` with `context: 'locked_trip'`

  **Expenses and Prework tab modifications**
  - [ ] If `!isPro`: render `<LockedFeaturePlaceholder feature="Expenses" />` full-screen
  - [ ] Same for Prework tab

  **Transfers tab modifications**
  - [ ] Flights segment: if `!isPro`, render `<LockedFeaturePlaceholder feature="Flights" />` in place of flight list
  - [ ] Vehicles segment: if `!isPro && lockedCount > 0`: render first vehicle normally + a `<LockedFeaturePlaceholder feature={`${lockedCount} more vehicles`} />` at bottom
  - [ ] Rentals segment: same pattern as vehicles

  **Profile screen (`apps/mobile/app/(tabs)/profile.tsx`) — additions**
  - [ ] `<ProBadge />` next to name when `isPro`
  - [ ] Day status row when `!isPro`: "X of 15 free days used this year" (from `useAnnualDayStatus`)
  - [ ] "Upgrade to Pro" primary button when `!isPro`; opens `PaywallSheet` with `context: 'locked_feature'`
  - [ ] `<ManageSubscriptionRow />` when `isPro`

  **Root layout (`apps/mobile/app/_layout.tsx`) — additions**
  - [ ] `initRevenueCat(userId)` after `hasSession && userId` confirmed (same location as push token registration)

- [ ] **4. RevenueCat + Play Console Setup** *(manual steps, not code)*

  - [ ] Create RevenueCat account → new project → link Google Play app (`com.vacationist.mobile`)
  - [ ] Upload `play-store-service-account.json` to RevenueCat
  - [ ] Create subscription products in Play Console: `vacationist_pro_monthly` (€2.99/mo), `vacationist_pro_annual` (€24.99/yr)
  - [ ] Create RevenueCat Offering `"default"` with monthly and annual packages
  - [ ] Configure RevenueCat webhook → `https://fsfsqghbejwvgxujoyne.supabase.co/functions/v1/revenue-cat-webhook` with shared secret
  - [ ] Store RevenueCat public SDK key in `EXPO_PUBLIC_REVENUECAT_API_KEY`

- [ ] **5. Legal & Privacy updates**

  - [ ] Update `docs/privacy-policy.html` — add subscription data section (RevenueCat processes purchase data; no card data stored by Vacationist)
  - [ ] Update `docs/terms-of-service.html` — subscription auto-renewal, cancellation, refund policy per Google Play; free tier limits; data preservation on expiry
  - [ ] Update Play Store listing — subscription pricing; in-app purchases declared in Play Console content rating

---

**Key implementation rules:**
- RevenueCat SDK is the source of truth for `isPro` in the UI. The `is_pro` DB column is updated by the webhook and used for server-side logic only.
- **No data is ever deleted** when Pro expires. All Pro content is hidden client-side and fully restored on reactivation.
- Feature locks are enforced at the application layer (query hook return values + UI gates) only. Do not add `is_pro` checks to any RLS policy.
- Day consumption from the annual quota is permanent — soft-deleted/archived trips do not return their days. This is the primary anti-gaming mechanism.
- Never block a participant from joining a trip based on the organizer's Pro status. The `max_members` gate applies at join time based on the trip's creation tier.
- `PURCHASE_CANCELLED` errors must be swallowed silently — the user dismissed the payment sheet, no toast.

---

## 🌐 Phase 12: Web Push Notifications
*Dependencies: Phase 8 (Notifications), Phase 10 (Web App / Vercel)*
*Goal: Deliver push notifications to users on `web.vacationist.app` in Chrome, Firefox, and Safari 16.4+, even when the browser tab is closed.*

### Architecture Overview

Web push is a separate protocol from Expo push — it uses the **Web Push API** (RFC 8030) with **VAPID** authentication (RFC 8292). The two pipelines run in parallel: every notification INSERT fires the existing DB trigger, and the `push-notification` Edge Function now delivers to both Expo tokens (native) AND Web Push subscriptions (browser).

```
DB trigger (AFTER INSERT on notifications)
  → net.http_post → push-notification Edge Function
       ├── Expo Push API → FCM → Android device   (existing)
       └── Web Push API  → Browser Service Worker (new)
```

**Browser support:** Chrome 50+, Firefox 44+, Safari 16.4+ on macOS. **iOS caveat:** on iOS, Web Push only works for web apps added to the Home Screen (PWA install) — it does not work in regular mobile Safari or any in-browser tab on iOS. Android Chrome works in-browser without a Home Screen install.

**Key design decisions:**
- Service worker lives at `apps/mobile/public/sw.js` → deployed at `/sw.js` by Expo's Metro web bundler (files in `public/` are copied verbatim to `dist/`)
- VAPID keys are generated once offline; private key stored as a Supabase Edge Function secret, public key as a Vercel env var
- Web push subscriptions live in their own `web_push_subscriptions` table — separate from `user_push_tokens` to keep the schemas clean
- Stale subscriptions (HTTP 410 Gone) are auto-deleted by the Edge Function on delivery failure, matching the existing Expo token cleanup pattern
- Notification preferences (`notification_preferences` table) apply equally to web push — the Edge Function already checks them before sending to Expo tokens, and will do the same for web push

---

- [ ] **1. DB/RLS & Types**

  **Migration — `YYYYMMDDHHMMSS_create_web_push_subscriptions.sql`**

  - [ ] **Table `public.web_push_subscriptions`**
    ```sql
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
    user_id     UUID REFERENCES public.users(id) ON DELETE CASCADE
    endpoint    TEXT NOT NULL                          -- browser push endpoint URL
    p256dh_key  TEXT NOT NULL                          -- base64url DH public key
    auth_key    TEXT NOT NULL                          -- base64url auth secret
    user_agent  TEXT                                   -- for debugging/analytics
    created_at  TIMESTAMPTZ DEFAULT NOW()
    updated_at  TIMESTAMPTZ DEFAULT NOW()              -- trigger-maintained
    UNIQUE(user_id, endpoint)
    ```
  - [ ] `set_updated_at` BEFORE UPDATE trigger on `web_push_subscriptions`
  - [ ] Index on `user_id` (for per-user token lookup in Edge Function)
  - [ ] **RLS:**
    - SELECT: `auth.uid() = user_id`
    - INSERT: `WITH CHECK (false)` — only via SECURITY DEFINER RPC
    - UPDATE: `WITH CHECK (false)` — only via SECURITY DEFINER RPC
    - DELETE: `auth.uid() = user_id` (allow client-side unsubscribe)
  - [ ] **RPC `upsert_web_push_subscription(p_endpoint TEXT, p_p256dh_key TEXT, p_auth_key TEXT, p_user_agent TEXT DEFAULT NULL)`** SECURITY DEFINER SET search_path = '' — upserts on `(user_id, endpoint)` conflict, updates `p256dh_key`, `auth_key`, `user_agent`, `updated_at`
  - [ ] **RPC `delete_web_push_subscription(p_endpoint TEXT)`** SECURITY DEFINER SET search_path = '' — deletes own subscription by endpoint value

  **Types (`packages/types/src/database.ts`)**
  - [ ] Add `WebPushSubscription` interface:
    ```typescript
    export interface WebPushSubscription {
      id: string;
      user_id: string;
      endpoint: string;
      p256dh_key: string;
      auth_key: string;
      user_agent: string | null;
      created_at: string;
      updated_at: string;
    }
    ```
  - [ ] Add `WebPushSubscriptionInput` to `packages/types/src/schemas.ts`:
    ```typescript
    export const webPushSubscriptionSchema = z.object({
      endpoint: z.string().url(),
      p256dhKey: z.string().min(1),
      authKey: z.string().min(1),
      userAgent: z.string().optional(),
    });
    export type WebPushSubscriptionInput = z.infer<typeof webPushSubscriptionSchema>;
    ```

---

- [ ] **2. VAPID Key Generation & Secrets Setup** *(manual one-time step — do before any code is deployed)*

  **Generate keys (run once locally, never commit the private key):**
  ```bash
  npx web-push generate-vapid-keys --json
  # → { "publicKey": "B...", "privateKey": "d..." }
  ```

  **Set Edge Function secrets on both projects:**
  ```bash
  # Dev
  npx supabase secrets set VAPID_PUBLIC_KEY="<publicKey>"  --project-ref aejywkbkcwyanhyzhrle
  npx supabase secrets set VAPID_PRIVATE_KEY="<privateKey>" --project-ref aejywkbkcwyanhyzhrle
  npx supabase secrets set VAPID_SUBJECT="mailto:hello@vacationist.app" --project-ref aejywkbkcwyanhyzhrle

  # Prod
  npx supabase secrets set VAPID_PUBLIC_KEY="<publicKey>"  --project-ref fsfsqghbejwvgxujoyne
  npx supabase secrets set VAPID_PRIVATE_KEY="<privateKey>" --project-ref fsfsqghbejwvgxujoyne
  npx supabase secrets set VAPID_SUBJECT="mailto:hello@vacationist.app" --project-ref fsfsqghbejwvgxujoyne
  ```

  **Set Vercel environment variable (web client needs the public key):**
  - In Vercel Dashboard → Project → Settings → Environment Variables:
    - `EXPO_PUBLIC_VAPID_PUBLIC_KEY` = `<same publicKey>` — all environments
  - Also add to local `.env` for `expo start --web`:
    ```
    EXPO_PUBLIC_VAPID_PUBLIC_KEY=<publicKey>
    ```

  > **Security note:** The VAPID public key is safe to embed in the client — it is mathematically bound to the private key but cannot derive it. Only the private key must be kept secret (in Supabase secrets, never committed).

---

- [ ] **3. Service Worker**

  **`apps/mobile/public/sw.js`** (new file — served at `/sw.js` by Expo's Metro static output)

  - [ ] `install` and `activate` event handlers with `self.skipWaiting()` + `clients.claim()` so the worker takes control immediately on first activation
  - [ ] **`push` event handler:**
    - Parse `event.data.json()` → `{ title, body, data }`
    - Call `self.registration.showNotification(title, { body, icon, badge, data, tag })` inside `event.waitUntil`
    - `icon`: `/notification-icon.png` (see asset step below)
    - `badge`: `/notification-icon.png`
    - `tag`: `data.notificationId` — deduplicates if the same notification fires twice
    - `requireInteraction: false` — auto-dismiss after default system timeout
  - [ ] **`notificationclick` event handler:**
    - `event.notification.close()`
    - Extract `{ type, tripId, relatedType }` from `event.notification.data`
    - Run `resolvePath(type, tripId, relatedType)` — same logic as `resolveNotificationPath.ts` but returns web URL strings:
      - `'new_activity'` / `'schedule_change'` → `/trip/<tripId>?tab=Activities`
      - `'vote_finalized'` / `'vote_update'` → `/trip/<tripId>?tab=Base` (accommodation) or `?tab=Activities`
      - `'expense_change'` → `/trip/<tripId>?tab=Expenses`
      - `'new_member'` → `/trip/<tripId>?tab=Settings`
      - `'document_access_request'` → `/profile`
      - `'reminder'` → `/trip/<tripId>`
      - fallback → `/`
    - `clients.matchAll({ type: 'window', includeUncontrolled: true })` → focus existing tab if found, else `clients.openWindow(path)`
  - [ ] **Self-contained** — no imports, no bundler. Pure ES5-compatible JS so it works in all service worker environments without a build step.

  **`apps/mobile/public/notification-icon.png`** (new file)
  - [ ] Copy `apps/mobile/assets/images/notification-icon.png` to `apps/mobile/public/notification-icon.png` — this makes it available at `/notification-icon.png` on the deployed web app for the service worker to reference

---

- [ ] **4. Client-Side Registration**

  **`apps/mobile/src/features/notifications/utils/registerForWebPush.ts`** (new file)

  - [ ] Guard: return `false` early if `Platform.OS !== 'web'`, `typeof window === 'undefined'`, `!('serviceWorker' in navigator)`, `!('PushManager' in window)`, or `VAPID_PUBLIC_KEY` env var is empty
  - [ ] `urlBase64ToUint8Array(base64String: string): Uint8Array` — converts VAPID public key from URL-safe base64 to `Uint8Array` for `pushManager.subscribe` (standard conversion: replace `-`→`+`, `_`→`/`, add padding, then `atob`)
  - [ ] Call `Notification.requestPermission()` — if not `'granted'` return `false`
  - [ ] `navigator.serviceWorker.register('/sw.js', { scope: '/' })` + `await navigator.serviceWorker.ready`
  - [ ] `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) })`
  - [ ] Extract keys: `subscription.getKey('p256dh')` and `subscription.getKey('auth')` — convert each `ArrayBuffer` to standard base64 using a loop (not spread, which can overflow the call stack on large buffers):
    ```typescript
    function arrayBufferToBase64(buf: ArrayBuffer): string {
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    }
    ```
  - [ ] Call `upsertWebPushSubscription({ endpoint, p256dhKey, authKey, userAgent: navigator.userAgent })`
  - [ ] Return `true` on success; catch all errors silently and return `false` (push is non-critical — the app works without it)
  - [ ] Export `async function registerForWebPushAsync(): Promise<boolean>`

  **`apps/mobile/src/features/notifications/utils/unregisterWebPush.ts`** (new file)
  - [ ] `getWebPushEndpoint(): Promise<string | null>` — gets existing subscription endpoint via `navigator.serviceWorker.ready` → `registration.pushManager.getSubscription()` → `subscription?.endpoint ?? null`
  - [ ] `unregisterWebPushAsync(): Promise<void>` — gets the existing subscription, calls `deleteWebPushSubscription(endpoint)` (DB cleanup), then `subscription.unsubscribe()` (browser cleanup); guards for missing service worker support
  - [ ] Both functions guard with `typeof window === 'undefined'` and `!('serviceWorker' in navigator)`

---

- [ ] **5. API Package**

  **`packages/api/src/webPush.ts`** (new file)

  - [ ] `upsertWebPushSubscription(input: WebPushSubscriptionInput): Promise<void>` — calls `supabase.rpc('upsert_web_push_subscription', { p_endpoint, p_p256dh_key, p_auth_key, p_user_agent })`; throws on error
  - [ ] `deleteWebPushSubscription(endpoint: string): Promise<void>` — calls `supabase.rpc('delete_web_push_subscription', { p_endpoint })`; throws on error
  - [ ] Both exported from `packages/api/src/index.ts`

---

- [ ] **6. Edge Function Update**

  **`supabase/functions/push-notification/index.ts`** — update to add web push delivery alongside existing Expo push

  - [ ] Add `import webPush from 'npm:web-push';` at top
  - [ ] At module level (runs once on cold start), initialise VAPID if secrets are present:
    ```typescript
    const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')  ?? '';
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
    const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT')     ?? '';
    const webPushConfigured = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);
    if (webPushConfigured) {
      webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    }
    ```
  - [ ] Add `WebPushSubRow` type: `{ user_id: string; endpoint: string; p256dh_key: string; auth_key: string }`
  - [ ] Add helper `sendWebPushToUsers(userIds: string[], payload: object): Promise<string[]>` — returns array of stale (410) endpoints:
    - Returns early if `!webPushConfigured` or `userIds.length === 0`
    - Queries `web_push_subscriptions` for `user_id IN (userIds)`
    - For each row, calls `webPush.sendNotification({ endpoint, keys: { p256dh: row.p256dh_key, auth: row.auth_key } }, JSON.stringify(payload))` — catches errors:
      - status 410 (Gone) or 404 (Not Found): collect endpoint as stale
      - other errors: log with `console.error` and continue (do not throw — one bad subscription must not block others)
    - Deletes stale endpoints from `web_push_subscriptions` via `supabase.from('web_push_subscriptions').delete().in('endpoint', staleEndpoints)`
    - Runs all `webPush.sendNotification` calls concurrently with `Promise.allSettled`
  - [ ] In `handleSingle`: after existing Expo push block, call `sendWebPushToUsers` with the single `user_id` and the translated title/body/data payload; the `data` object mirrors the Expo `data` field (`{ notificationId, tripId, type, relatedType, relatedId }`)
  - [ ] In `handleBatch`: the `sendWebPushToUsers` signature must accept a per-user payload builder, not a single shared payload, so each recipient gets the correct `notificationId`. Change the signature to `sendWebPushToUsers(userIds: string[], buildPayload: (userId: string) => object)` and have `handleBatch` pass `(uid) => ({ title: translated.title, body: translated.body, data: { notificationId: userToNotificationId.get(uid), tripId, type, relatedType, relatedId } })`. This ensures tapping a web push notification marks the right DB row as read — using `notificationId: null` would silently break read-tracking for batch pushes.
  - [ ] **Web push payload shape** (what the service worker receives):
    ```json
    {
      "title": "<translated title>",
      "body": "<translated body>",
      "data": {
        "type": "new_activity",
        "tripId": "<uuid>",
        "relatedType": "activity",
        "relatedId": "<uuid>",
        "notificationId": "<uuid>"
      }
    }
    ```
  - [ ] Deploy to dev + prod after implementation: `npx supabase functions deploy push-notification --project-ref <ref>`

---

- [ ] **7. App Integration**

  **`apps/mobile/app/_layout.tsx` — `AuthGate` component**

  - [ ] Add `import { registerForWebPushAsync } from '../src/features/notifications/utils/registerForWebPush';`
  - [ ] Inside the `useEffect` that already calls `registerForPushNotificationsAsync()`, add a parallel call for web:
    ```typescript
    useEffect(() => {
      if (!hasSession || !userId) return;
      registerForPushNotificationsAsync().then((token) => setPushToken(token));
      if (Platform.OS === 'web') {
        registerForWebPushAsync(); // fire-and-forget
      }
    }, [hasSession, userId, setPushToken]);
    ```
  - [ ] No state storage needed for the web push subscription endpoint in `authStore` — `unregisterWebPushAsync` reads the endpoint directly from the service worker at sign-out time

  **`apps/mobile/src/features/auth/hooks/useSignOut.ts`**
  - [ ] Add `import { unregisterWebPushAsync } from '../notifications/utils/unregisterWebPush';`
  - [ ] Before `signOut()`, call `unregisterWebPushAsync()` on web (guards its own platform check), alongside the existing `deletePushToken(pushToken)` call for native — both run before the session is destroyed

---

- [ ] **8. Vercel Config**

  **`vercel.json`** — add `Cache-Control: no-store` header on the service worker so browsers always fetch the latest version:

  ```json
  {
    "buildCommand": "node scripts/build-web.cjs",
    "outputDirectory": "apps/mobile/dist",
    "framework": null,
    "headers": [
      {
        "source": "/sw.js",
        "headers": [
          { "key": "Cache-Control", "value": "no-store, max-age=0" },
          { "key": "Service-Worker-Allowed", "value": "/" }
        ]
      }
    ],
    "rewrites": [
      { "source": "/sitemap", "destination": "/sitemap.xml" },
      { "source": "/sw.js", "destination": "/sw.js" },
      { "source": "/(.*)", "destination": "/index.html" }
    ]
  }
  ```

  > **Why the explicit `/sw.js` rewrite:** Vercel normally serves static files before evaluating rewrites, but this only applies when the file exists in the output directory at request time. During cold starts or edge cases the catch-all `/(.*) → /index.html` can intercept the request first, returning the SPA shell instead of the service worker JS. The browser would then register `index.html` as a service worker and immediately throw a parse error, silently disabling web push for that user. The explicit passthrough rewrite before the catch-all eliminates this race.

  > **Why `no-store`:** Browsers cache service workers aggressively. Without this header, an updated `sw.js` may not be picked up until the old worker's cache expires (up to 24 hours by default), leaving users on old notification behaviour.

---

- [ ] **9. Privacy Policy Update**

  **`docs/privacy-policy.html`** — add a paragraph under the data processing section:
  - [ ] Mention that browser push subscriptions (endpoint URL + encryption keys) are stored in the Vacationist database when the user grants notification permission in the browser
  - [ ] Clarify that subscriptions are deleted on sign-out or when the user revokes permission
  - [ ] No personal content is stored in the subscription — only the cryptographic keys needed to deliver push messages

---

### Key Implementation Rules for Phase 12

- **VAPID private key must never be committed** to version control or stored in `supabase/vault`. Use `supabase secrets set` only. The public key is safe to expose in `EXPO_PUBLIC_VAPID_PUBLIC_KEY`.
- **The service worker must be plain ES5-compatible JavaScript** with no imports. It is served as a static file and is not processed by the Metro bundler.
- **`userVisibleOnly: true`** is mandatory in `pushManager.subscribe` — browsers require every push to result in a visible notification. Push messages received without showing a notification will cause the browser to revoke the subscription.
- **Graceful degradation:** If the user denies notification permission, `registerForWebPushAsync` returns `false` silently. The app continues to work. Never block the UI on push permission.
- **No new DB trigger needed:** The existing `trg_dispatch_push_notification` trigger already fires on every `notifications` INSERT and calls the Edge Function. The Edge Function update in Step 6 makes it also deliver to web push subscribers — no migration is needed to change the trigger itself.
- **Notification preferences apply to web push** identically to Expo push — the Edge Function checks `notification_preferences` before sending to either delivery channel. No extra preference columns are needed.
- **Test on HTTPS only:** The Web Push API and service workers require a secure context (`https://` or `localhost`). They will not work on plain `http://` origins. Vercel preview URLs are HTTPS, so testing on any Vercel deployment works.

---

## 💬 Phase 13: Trip Chat
*Dependencies: Phase 1 (Auth), Phase 2 (Trips & Members)*
*Goal: One lightweight chat per trip — keep trip-related communication inside the trip context. Not a WhatsApp replacement: text only, no reactions/threads/typing indicators/read receipts/attachments.*

- [x] **1. DB/RLS & Types**
  - [x] Migration `20260716100000_create_trip_messages.sql` — `trip_messages` table (id, trip_id, created_by, text ≤2000, created_at, updated_at, deleted_at), partial index `(trip_id, created_at DESC) WHERE deleted_at IS NULL` for keyset pagination
  - [x] RLS: members SELECT (no deleted_at filter so soft-delete UPDATEs pass realtime RLS); members INSERT own; sender-only UPDATE while not deleted; no DELETE policy
  - [x] `soft_delete_trip_message` RPC (SECURITY DEFINER) — sender deletes own (incl. guests), organizer deletes any
  - [x] `set_updated_at` + immutable-fields triggers (trip_id, created_by, created_at)
  - [x] Realtime enabled via `ALTER PUBLICATION supabase_realtime ADD TABLE trip_messages` (soft delete arrives as UPDATE — no REPLICA IDENTITY FULL needed)
  - [x] Types: `TripMessage`, `TripMessageWithSender`, `TripMessagesPage` in `packages/types/src/database.ts`; Zod schemas + mutation Variables in `schemas.ts`
- [x] **2. Services & Hooks**
  - [x] `packages/api/src/messages.ts` — `getTripMessages(tripId, cursor?)` (keyset pagination, page 50, joins `sender:users!created_by`), `createMessage`, `updateMessage`, `deleteMessage` (RPC), `subscribeToMessages` (`trip-messages:${tripId}`, INSERT+UPDATE filtered on trip_id), `unsubscribeFromMessages`
  - [x] `useTripMessages` (`useInfiniteQuery`, key `['trips', tripId, 'messages']`), `useCreateMessage`/`useUpdateMessage`/`useDeleteMessage` with optimistic updates + rollback
  - [x] `useTripChatRealtime` — cache patching via pure helpers (`messageCache.ts`, unit-tested); realtime INSERT sender enrichment from members cache; optimistic/echo dedupe
  - [x] Offline replay: mutation defaults + `PERSISTED_MUTATION_KEYS` (`createTripMessage`, `updateTripMessage`, `deleteTripMessage`); surgical `setQueryData` in onSuccess (no infinite-query invalidation)
- [x] **3. Components & Screens**
  - [x] Chat tab between Overview and Prework (`app/trip/[id]/chat.tsx` + TABS wiring)
  - [x] `ChatMessageRow` (MemberAvatar + name + absolute timestamp + text, long-press for actions), `ChatInputBar` (multiline, edit mode strip), `MessageActionsSheet` (edit own / delete own-or-organizer with inline confirm)
  - [x] Non-inverted FlashList with `maintainVisibleContentPosition` (auto-scroll to newest) + `onStartReached` older-page loading
  - [x] Empty state ("Start the conversation with your travel group."), i18n namespace `chat` (en+de), `tab.chat` labels
  - [x] Tutorial slide 1 mentions chat (en+de), MMKV key bumped `tutorial_seen_v1` → `v2`
  - [x] `create-example-trip` edge function seeds 2 example messages (deployed to dev + prod)

---

## 📊 Phase 14: Reddit Pixel & Funnel Dashboard
*Dependencies: none*
*Goal: Reddit Ads is now running and needs conversion signal fed back to it. Close the attribution chain — Reddit Pixel + click-through tracking on the marketing site, a click-ID handoff through the Play Store install referrer into the native app, server-side sign-up attribution via Reddit's Conversions API, and a first-party funnel event log independent of both Reddit's own reporting and ad blockers.*

**Key decisions (Tech Lead):** funnel scope = web pixel **+** server-to-server CAPI for native sign-ups; one combined Analytics+Advertising consent banner (not separate toggles); dashboard data = self-hosted event log, not GA4/Reddit-API pulls; dashboard host = local-only Node script (not a hosted admin route); **no raw IP ever stored** — `rdt_cid` + UTM + referrer host + user-agent + daily-rotating salted visitor hash only; **log nothing without consent** (no anonymous-aggregate fallback); guest joins (via a friend's trip link) never count as a `SignUp` conversion — only real account creation or a guest→full-account upgrade; `analytics_events` retention = 14 months (cron-pruned).

- [x] **1. First-party event log**
  - [x] Migration `20260808100000_create_analytics_events.sql` — `analytics_events` table (event_name/surface CHECK allowlists, no IP column, `user_id UUID REFERENCES users(id) ON DELETE SET NULL` — deliberately `SET NULL`, not a bare FK, so `delete_own_account()` needs no companion change), RLS fully locked to `service_role` (explicit deny-all INSERT/UPDATE/DELETE for `anon`/`authenticated`, no SELECT policy for either)
  - [x] Migration `20260808110000_create_analytics_events_retention_cron.sql` — `private.prune_analytics_events()` + daily `pg_cron` job, 14-month window
  - [x] Edge Function `track-event` — the repo's first browser-facing function (CORS origin allowlist, `OPTIONS` preflight, `event_name`/`surface` allowlist validation, IP-shaped-value rejection, server-side daily-rotating salted `visitor_hash` via `ANALYTICS_VISITOR_HASH_SALT` secret); `verify_jwt = false`
  - [x] `packages/types/src/analytics.ts` (event name/surface enums, `logAnalyticsEventSchema`, `signUpAttributionSchema`), `packages/api/src/analytics.ts` (`logAnalyticsEvent`, `reportSignUpAttribution`)
  - [x] Applied to dev + prod; curl-verified (valid → `204`, bad event name → `400`, disallowed origin → `403`, IP-shaped field → `400`, anon SELECT/INSERT blocked by RLS)
- [x] **2. Marketing site (vacationist.app)**
  - [x] `marketing/site/consent.js` — extended to cover Analytics **and** Advertising under one Accept/Decline; `SCHEMA` bumped 1→2 (invalidates prior analytics-only consents, re-prompts once); `loadRdt()` (real Pixel ID `a2_jcz7aqtl8eua`); `window.__vConsent` + `v:consent` event published for `track.js`
  - [x] New `marketing/site/track.js` — first-touch `rdt_cid`/UTM capture, Play Store link rewrite (`&referrer=` encoding — the native CAPI handoff) **and** Web App link rewrite (plain query params — the web CAPI handoff, since web.vacationist.app is a different origin and localStorage never carries across), delegated click tracking (Play Store, Web App, and the two non-clickable App Store "Coming Soon" `<div>`s as an interest signal via class selector), page-visit logging — all no-op without consent
  - [x] Wired into `build.mjs` (`renderPage` head, copy step, all 36 generated pages) + all 7 hand-authored pages (`index`, `privacy-policy`, `terms-of-service`, `impressum`, `404`, `join`, `scan/android-qr`); root-absolute script path so `/de/` inherits for free
  - [x] `consent.test.js` extended: Reddit Pixel assertions on every existing scenario, new "Schema migration" suite (a v1 grant re-prompts under the new banner), withdrawal sweep covers `_rdt*` cookies too
  - [x] Live-verified in Chrome (twice — see engineering/supabase.md is DB-only, this is UI-only so logged here): zero requests pre-consent, real Reddit Pixel `PageVisit`/`Lead` fire post-accept with the correct pixel ID, Play Store link correctly rewritten with encoded attribution. Re-verified with a simulated real ad click (`?rdt_cid=...&utm_source=reddit&...`): the pixel's own `PageVisit` beacon and the rewritten Play Store `referrer=` param both correctly reflect the fresh click id — confirms the pass-through mechanism end to end. A synthetic `click_id` in these tests correctly triggers Reddit Events Manager's "Invalid click ID" warning — expected, since it isn't a real Reddit-issued token; the app never constructs or validates that value, only passes through whatever Reddit puts on the URL, so a real ad click will already carry a valid one. True click-ID validation still requires a real ad click or Reddit's own Test Events tool — not done this session.
- [x] **3. Web app (web.vacationist.app)**
  - [x] `consentStore.ts` (Zustand, mmkv-web-backed, same schema shape as the marketing site — separate decision, different origin) + `ConsentBanner.tsx` (new `consent` i18n namespace, en/de) — verified across dark/light/colorful/system
  - [x] `webPixel.ts` (`loadRedditPixel`/`trackRedditEvent`, now accepts an optional `conversionId` for dedup — see item 4) + `useConsentPixel` mounted in root layout
  - [x] `ensureUserProfile` now returns `{ profile, isNew }`; `maybeTrackSignUp` (`features/consent/utils/trackSignUp.ts`) fires `SignUp` exactly once (module-level guard) for a genuine new account or guest→full upgrade only — never a raw guest join, never a session restore
  - [x] `webAttribution.ts` — captures `rdt_cid`/UTM from the landing query string **at module load** (before `AuthGate`'s redirect can strip it off the URL on an unauthenticated visit), held in memory only until consent is granted, matching "log nothing without consent"
  - [x] Caught pre-ship: banner copy originally claimed "Google Analytics" on web.vacationist.app, which never had GA wired up — corrected to describe only what's actually present (Reddit Pixel + first-party log)
- [x] **4. Sign-up attribution (install referrer / web query capture → Conversions API, with pixel deduplication)**
  - [x] `apps/mobile/src/features/attribution/utils/installReferrer.ts` — `Application.getInstallReferrerAsync()` (already-linked `expo-application`, no new native module), Android + Play Store installs only, MMKV-guarded to read exactly once per install, must-never-throw; fired fire-and-forget from the root layout
  - [x] Edge Function `attribution-capi` — unlike `track-event`, requires a real authenticated caller (`verify_jwt` left at platform default `true`, plus its own `auth.getUser(jwt)` re-derivation so an anon-key-only request is still rejected); accepts `surface` (`web_app` | `native_app`) and a required client-generated `conversion_id`; always logs to `analytics_events`; calls Reddit's Conversions API only when `rdt_cid` is present — an organic sign-up has nothing to attribute and there is no IP+UA fallback per the no-raw-IP decision
  - [x] **Deduplication**: `trackSignUp.ts` generates one `conversionId` per sign-up (`expo-crypto`'s `randomUUID()` — confirmed to have a real web implementation, not native-only, before relying on it) and passes it to *both* the client pixel call (`conversionId` metadata) and the CAPI call (`conversion_id` in the Reddit event) on web, so Reddit matches the two into one conversion instead of double-counting. Native has no pixel to pair with — CAPI is its only signal, `conversion_id` still sent for schema consistency.
  - [x] **Web now also fires CAPI** (previously pixel-only) — standard practice: the pixel alone isn't resilient to ad blockers, CAPI alone can't see everything a browser can. `marketing/site/track.js` gained `rewriteWebAppLinks()` (the missing half of the cross-origin handoff — Play Store already had it, Web App didn't) so `rdt_cid` actually reaches `web.vacationist.app` at all.
  - [x] New secrets (dev + prod): `REDDIT_AD_ACCOUNT_ID`, `REDDIT_CAPI_ACCESS_TOKEN`
  - [x] CAPI request shape (endpoint `.../api/v2.0/conversions/events/{account_id}`, body `{ test_mode, events: [{ event_at, event_type: { tracking_type }, click_id, conversion_id }] }`) cross-referenced across multiple third-party integration docs — **not independently confirmed against an official Reddit reference** (none is public); first thing to check in Reddit Events Manager's "Test Events" tool if events show rejected, or if the pixel/CAPI pair isn't actually deduplicating, after the next real release
  - [x] **Confirmed end-to-end on dev, web surface** (post-ship debugging session, see `engineering/supabase.md` 2026-08-08 entries for full traces): a real sign-up → `claimSignupAttribution` claims → `reportSignUpAttribution` → `attribution-capi` returns `204` (authenticated, real JWT) → a matching row lands in `analytics_events`. That test had no `rdt_cid` (direct sign-up, not via a Reddit click), so it proved the log-write path but not the actual Reddit CAPI POST branch — that still needs a real ad-click-driven sign-up. Play Store internal-testing install → sign up → confirm in Reddit Events Manager remains not done.
  - [x] **Bug found post-ship #1 (real signed-in sessions, not just unauthenticated test calls, always got `401`)** — `reportSignUpAttribution()` relied on `functions.invoke()`'s *implicit* Authorization injection, which re-reads the session inside an internal fetch wrapper with timing sensitive enough right after a sign-in event that it couldn't be trusted. Traced through the actual installed `@supabase/supabase-js`/`@supabase/functions-js` source (not guessed) — fixed by reading `getSession()` and attaching the token explicitly, matching the existing Auth Pattern rule. `attribution-capi` also now logs *why* a 401 happened (never the token itself) — it previously gave zero server-side signal, which is what made the bug invisible until manually reported. Redeployed to dev + prod.
  - [x] **Bug found post-ship #2 (structural — `isNew` was always `false`, for every sign-up, since Phase 1)** — `ensureUserProfile()` inferred novelty from whether a `public.users` row already existed, but the `on_auth_user_created` → `handle_new_user()` trigger (`20260511000001`) always creates that row server-side *before* the client ever checks — so the "new" branch was dead code from day one, not a race introduced by this phase. Fixed by replacing the row-existence check with an atomic DB claim: new nullable `public.users.signup_attribution_claimed_at` column, claimed via a single `UPDATE ... WHERE signup_attribution_claimed_at IS NULL RETURNING id` (migration `20260808120000_add_signup_attribution_claim.sql`, applied dev + prod). `ensureUserProfile` no longer returns `isNew`; `maybeTrackSignUp` (item 3 above) no longer takes `isNew`/`previousIsGuest` params at all — it calls the new `claimSignupAttribution(userId)` directly. Considered inferring novelty from `session.user.created_at`/`last_sign_in_at` first (a commonly cited trick) but rejected it as an unverified guess — Supabase's docs don't document the exact timing guarantee for magic-link flows, and this drives real ad-spend attribution.
  - [x] **Bug found post-ship #3 (`attribution-capi` had no CORS handling — 405 on every real browser call)** — the handler's very first check was `if (req.method !== 'POST') return 405`, with zero `OPTIONS`/`Access-Control-Allow-*` handling, unlike `track-event`. Every browser call to it is a cross-origin `POST` with a custom `Authorization` header, which requires a CORS preflight `OPTIONS` first — that preflight got 405'd, so the real POST was never attempted. Invisible all session because bug #2 meant the call was never even attempted before; this was the *next* real blocker once #2 was fixed. Fixed with an origin-allowlisted CORS layer (`https://web.vacationist.app` + `http://localhost:8081`, narrower than `track-event`'s since this function is only ever called from an authenticated app session). Redeployed to dev + prod, verified via direct `curl -X OPTIONS`.
- [x] **5. Legal**
  - [x] `docs/privacy-policy.html` + `marketing/site/content/de/legal/privacy-policy.md` (en/de kept in sync) — Reddit Pixel disclosure (Section 2, 5, 6), corrected the "we do not use data for advertising" claim in Section 3, corrected the native-app highlight box (no embedded SDK, but a single server-side CAPI report per sign-up when attributable), new "Our own analytics" subsection with an explicit no-raw-IP statement and the 14-month retention figure
  - [x] Reddit CAPI's "Add parameters" step (Ads Manager wizard) — Tech Lead decision: click_id only, no `external_id`/hashed-identity parameter added, consistent with the existing no-raw-IP stance
- [x] **6. Local funnel dashboard**
  - [x] `scripts/analytics-report.mjs` + `npm run analytics:report` — reads `analytics_events` via the service-role key from **`.env.production`** (repo root, gitignored, template `.env.production.example`) — deliberately a separate file from `.env.local` so pointing it at prod never requires touching whatever `.env.local` is used for locally; renders a self-contained HTML funnel report (visit → click → sign-up, segmented by `rdt_cid` present vs. organic vs. other UTM sources, capped at 3 named buckets + "Other")
  - [x] Built against the `dataviz` skill: validated reference categorical palette, mark specs (rounded bar ends, 2px gaps, hairline gridlines), legend + native SVG `<title>` hover tooltips, empty-state handling
  - [x] Live-verified in Chrome against synthetic dev data (funnel, segmentation, trend, top-pages table all render correctly); caught and fixed one real bug (a segmentation group label wasn't vertically centered against its bars); all synthetic test rows cleaned up from both dev and prod afterward
  - [x] Added a "Top campaigns (by sign-ups)" table — `utm_campaign` is stored in `analytics_events` but wasn't previously queried or shown anywhere; the segmentation chart above buckets by `utm_source`/`rdt_cid`, not `utm_campaign` (the "Open items" note below describing the dashboard as segmenting on `utm_campaign` was inaccurate — corrected here). New table shows visits/clicks/sign-ups per campaign, ranked by sign-ups, only for events that actually carry a `utm_campaign` (organic/direct excluded by design). Re-ran against prod — renders correctly (empty state, since no live campaign has used `utm_campaign` yet).

**Open items for the Tech Lead:**
- ~~Campaign naming convention for `utm_campaign`~~ — **proposed, awaiting Tech Lead adoption**: `utm_source` = single lowercase token (`reddit` for Reddit ads — also the fallback bucket if `rdt_cid` capture ever fails); `utm_medium` = `cpc` for paid Reddit, channel-appropriate otherwise; `utm_campaign` = `{platform}-{objective}-{yyyy-mm}[-{variant}]` e.g. `reddit-signups-2026-08-launch`. Correction to the original note: the dashboard's segmentation chart buckets by `utm_source`/`rdt_cid`, **not** `utm_campaign` — `utm_source` consistency is what actually matters for that chart; `utm_campaign` now has its own "Top campaigns" table (item 6) but isn't otherwise used yet.
- Widening the report-only CSP in `vercel.json` — **investigated, not resolved**: the policy has no `report-uri`/`report-to` directive at all, so no violation volume is being collected anywhere (only whatever DevTools console happens to be open at the time) — "once volume is known" isn't answerable as currently configured. Enumerated actual cross-origin dependencies a real allowlist would need: `www.redditstatic.com`, `pixel-config.reddit.com`, `alb.reddit.com` (Reddit pixel, confirmed live on `web.vacationist.app`), plus `*.supabase.co` and `challenges.cloudflare.com` (Turnstile) from the app's existing architecture. Tech Lead call: add the allowlist now (still report-only) or leave as a placeholder.
- Native attribution reporting currently relies on Privacy Policy disclosure rather than an in-app consent gate (the native app has no equivalent of `ConsentBanner`) — worth a final legal look. **Tech Lead decision: leave as-is.**
- ~~OTA-eligibility~~ — **resolved**: confirmed `apps/mobile/package.json` is untouched by this phase (`expo-application` still pinned at the pre-phase version, no plugin/SDK changes), so the native attribution change is genuinely OTA-eligible per CLAUDE.md's own rule. **Tech Lead decision: shipping via a full Play Store build via Expo regardless.**

---

## 🍎 Phase 16: iOS App Store Rollout (v1.32.0)
*Dependencies: none (iOS build config already shipped in v1.30.0, see engineering/supabase.md 2026-08-10)*
*Goal: iOS went GA on the App Store (`https://apps.apple.com/us/app/vacationist/id6800049398`). Replace every "Play Store only" / "iOS coming soon" surface across the app and marketing site with a real, live App Store presence, and make the post-trip rating nudge platform-aware.*

- [x] **1. Post-trip rating nudge — cross-platform**
  - [x] Migration `20260817100000_review_nudge_store_neutral.sql` — `CREATE OR REPLACE private.create_review_nudge_notifications()`, store-neutral body text (was hardcoded "...on the Play Store!")
  - [x] `supabase/functions/push-notification/index.ts` — `NOTIFICATION_TRANSLATIONS.review_nudge` (en/de) reworded store-neutral
  - [x] New `apps/mobile/src/utils/storeUrl.ts` (shared `STORE_URL` constant, de-duped out of `ForceUpdateGate.tsx`) and `apps/mobile/src/utils/openStoreReview.ts` (`openStoreReviewOrFallback()` — native `expo-store-review` prompt with a store-URL fallback)
  - [x] `resolveNotificationPath.ts` — removed hardcoded Play Store URL branch; the 3 tap call sites (`(tabs)/notifications.tsx`, `trip/[id]/notifications.tsx`, `usePushNotificationHandler.ts`) now special-case `related_type === 'review_nudge'` to call `openStoreReviewOrFallback()` instead — also fixed a pre-existing bug where the push-tap handler `router.push()`'d the raw store URL instead of opening it
  - [x] `NotificationItem.tsx` — added `review_nudge` to `BODY_TEMPLATES` + `resolveEffectiveType()`; added `type.review_nudge` i18n key (en/de) — the in-app list previously showed the raw English DB body under a generic "Reminder" title in both locales
- [x] **2. Marketing site — Play Store badges → dual-store badges**
  - [x] `marketing/site/build.mjs` — `APP_STORE_URL` constant; `operatingSystem: 'Android, iOS, Web'` + array `installUrl`/`downloadUrl` in JSON-LD; third App Store button in the sitewide `ctaHtml()` band; nav "Get the app" CTA now anchors to `#get-app`/`#download` instead of a hardcoded Play link
  - [x] `docs/i18n/{en,de}.js` — added `hero.getAppStore` / `dl.getAppStore` / `join.cta.getAppStore` / `scan.*.getAppStore` keys, retired the six `*.appSoon` keys, rewrote `entity.def` / `tldr.text` / `trust.platform`; bumped `CACHE_VER`
  - [x] `docs/index.html`, `docs/join.html`, `docs/scan/android-qr/index.html` — both "App Store — Coming Soon" placeholder `<div>`s per page converted to real `apps.apple.com` links (android-qr page keeps its existing URL/QR asset per Tech Lead decision — no new iOS QR was created)
  - [x] `marketing/site/track.js` — new `app_store_click` event on real App Store link clicks; retired the old div-class-based `app_store_interest` "interest" detection now that the badges are real links
  - [x] ~20 EN + ~20 DE content pages (`vs/`, `alternatives/`, `features/`, `use-cases/`, `blog/`) — replaced "Android + web (iOS in development)" copy with accurate iOS/Android/web platform statements
  - [x] Legal pages (`privacy-policy`, `impressum`, `delete-account`, EN + DE) — added the Apple App Store alongside Google Play; privacy policy also now discloses that the Reddit install-referrer attribution path is Android-only with no iOS equivalent
  - [x] `docs/llms.txt` + `apps/mobile/public/llms.txt` — added the iOS App Store line, corrected "Android and web" prose
- [x] **3. Analytics taxonomy**
  - [x] Migration `20260817110000_add_app_store_click_event.sql` — added `'app_store_click'` to `analytics_events.event_name` CHECK (kept `'app_store_interest'` for historical rows)
  - [x] `supabase/functions/track-event/index.ts` `EVENT_NAMES`, `scripts/analytics-report.mjs` (`isClick()` now counts `app_store_click`; dropped the now-meaningless `app_store_interest`/"iOS interest clicks" KPI tile and segmentation row)
- [x] **4. Verification**
  - [x] `npm run typecheck` + `npm test` (root) clean
  - [x] `npm run build:site` run twice — byte-identical `docs/` tree (hash-diffed), confirming deterministic output
  - [x] Live-verified in Chrome (`npm run serve:docs`): EN + DE homepage, `/join.html`, `/scan/android-qr/` all render live App Store badges/links correctly; nav "Get the app" anchor-scrolls correctly; a real click on the App Store badge fired `app_store_click` to `track-event` (400 expected — edge function not yet redeployed, pending Tech Lead go-ahead)

**Explicitly out of scope (Tech Lead decision):** no new iOS-specific QR asset (`qr-codes/android-qr` already carries both store links after this pass); no repo-side `app-store/` listing folder mirroring `play-store/` (App Store Connect metadata managed directly in ASC); no Apple Search Ads / SKAdNetwork / deferred-deep-link iOS attribution buildout.

**Deployed 2026-08-17 (Tech Lead go-ahead given):** both migrations and both Edge Function redeploys (`push-notification`, `track-event`) applied to dev then prod Supabase, verified end-to-end. See `engineering/supabase.md` 2026-08-17 entry for details.

**Not yet done:** `git commit`/`git push` of the app code and marketing site changes to `main` — separate action, pending explicit approval (GitHub Pages deploy + OTA update aren't gated by the Supabase Changes Workflow the way the DB/Edge Function side was).
