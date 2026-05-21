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
  - [x] **3.14 Register Transfer tab in `apps/mobile/app/trip/[id]/_layout.tsx`**
    - [x] Add `'Transfer'` to TABS array between `'Base'` and `'Activities'`
    - [x] Import `TransferTab` from `./transfer`
    - [x] Add `case 'Transfer': return <TransferTab />;` in `renderTab()`

---

## 🔔 Phase 8: Notifications
*Dependencies: Phases 3, 4a, 4b, 5a, 5b & 5c*
*Goal: Batched push notifications and in-app alerts.*

- [ ] **1. DB/RLS & Types**
  - [ ] Create `notifications` and `notification_preferences` tables + RLS
- [ ] **2. Services & Hooks**
  - [ ] Setup Expo Notifications SDK and token registration
  - [ ] Implement backend dispatch logic (batching multiple events)
  - [ ] Create preference toggle hooks
- [ ] **3. Components & Screens**
  - [ ] Implement Notification Center slide-out/screen
  - [ ] Add notification preference toggles to Trip Settings
  - [ ] Allow the organizer of a trip to trigger predefined playful/waggish random selected messages like
        "Are you in favor of dictatorships? If not, live for democracy now!" or "Three hot women nearby already voted, now its your turn!"

---

## ✨ Phase 9: Polish & Hardening
*Dependencies: All previous phases*
*Goal: Production & legal readiness; Google Play Store.*

- [ ] **1. UI/UX Polish**
  - [ ] Implement Skeleton Screens (`TripListSkeleton`, `ActivityListSkeleton`, etc.)
  - [ ] Finalize Guest upgrade flow UI
- [ ] **2. Security & Performance**
  - [ ] Conduct full RLS audit on all tables
  - [ ] Implement rate limiting via Edge Functions/DB triggers
  - [ ] Implement list virtualization (`FlashList` or `FlatList` optimizations)
- [ ] **3. DevOps**
  - [ ] Configure Expo EAS build profiles
  - [ ] Setup OTA updates
  - [ ] Optimize the EAS build using this [guide](https://expo.dev/blog/build-fast-no-matter-what-how-expo-is-optimizing-for-speed)
  - [ ] Production database & deployment etc.
- [ ] *4. Third-party style guidelines*
  - [ ] Sign in with Google Branding IMPORTANT
  - [ ] Scan the code base for other relevant guidelines and fullfil them
- [ ] *5. Prepare Google Play Store release*
  - [ ] Technical details like Target API Level, Production Build & more
  - [ ] Google Play Console Assets like the app icon etc.
  - [ ] Compliance & Policy
  - [ ] Release Strategy
  - [ ] Expo-Specific Deployment like a Service Account or Automated Submission

## 🌐 Phase 10: Landing Page / Marketing Website (Web UI)
*Dependencies: Phase 9*
*Goal: Create a polished, responsive, mobile-first landing page for Vacationist.*

- [ ] **1. Content**
  - [ ] Explains the product clearly within seconds
  - [ ] Showcases the core features visually
  - [ ] Demonstrates the collaborative vacation planning workflow
  - [ ] Allows users to immediately enter the web app
  - [ ] Provides a QR code + Play Store/App Store links for mobile onboarding
  - [ ] Switzerland policies and impressum for a private person (Nebererwerbstätigkeit) ask me for details like name etc.
  - [ ] Establishes a modern product identity and trust
  - [ ] SEO optimizations & metadata including robots file etc.
- [ ] **2. It does NOT implement the actual web app itself, it focuses purely on**
  - [ ] Marketing & product presentation
  - [ ] Onboarding
  - [ ] App distribution entry points
- [ ] **3. Landing page feeling**
  - [ ] Modern & lightweight
  - [ ] Premium & fast
  - [ ] Social & collaborative
  - [ ] Travel-oriented
- [ ] *4. Avoid the following*
  - [ ] Enterprise/SaaS aesthetics
  - [ ] Dark corporate UI
  - [ ] AI buzzword marketing
  - [ ] Feature overload
  - [ ] Pricing sections (V1 has no monetization)
