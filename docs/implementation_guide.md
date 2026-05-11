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

### Google OAuth using Supabase OAuth App (Vacationist) & Google Sign In / Provider
Site URL: http://localhost:3000
Authorization Path: /oauth/consent
Authorization endpoint: https://aejywkbkcwyanhyzhrle.supabase.co/auth/v1/oauth/authorize
Token endpoint: https://aejywkbkcwyanhyzhrle.supabase.co/auth/v1/oauth/token
JWKS endpoint: https://aejywkbkcwyanhyzhrle.supabase.co/auth/v1/.well-known/jwks.json
OIDC discovery: https://aejywkbkcwyanhyzhrle.supabase.co/auth/v1/.well-known/openid-configuration
OAuth app:
- Client ID: 9d40a6d2-1601-4049-94e6-207628f0c073
- Redirect URI: https://aejywkbkcwyanhyzhrle.supabase.co/auth/v1/callback
- Public Client: enabled

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

- [ ] **1. DB/RLS & Types**
  - [ ] Create `trips` and `trip_members` tables with RLS
  - [ ] Create `invite_tokens` table with expiry/usage logic
  - [ ] Generate Zod schemas for trip creation and validation
- [ ] **2. Services & Hooks**
  - [ ] Create trip CRUD services and member management services
  - [ ] Implement TanStack Query hooks (`useTrips`, `useTrip`, `useCreateTrip`)
- [ ] **3. Components & Screens**
  - [ ] Build `TripCard`, `MemberAvatar`, and layout primitives
  - [ ] Implement Trip List screen (`/app/(tabs)`)
  - [ ] Implement Trip Detail shell (Header + Navigation tabs)
  - [ ] Implement Trip Settings (Manage members, generate invites)

---

## 🎯 Phase 3: Activities & Voting System
*Dependencies: Phase 2*
*Goal: Activity planning and the non-numerical voting engine.*

- [ ] **1. DB/RLS & Types**
  - [ ] Create `activities` and `activity_votes` tables + RLS
  - [ ] Define Vote TypeScript enums (`must_do`, `like`, `open`, `skip`, `group_blocker`)
- [ ] **2. Services & Hooks**
  - [ ] Implement Activity CRUD and optimistic Vote Upsert services
  - [ ] Implement auto-finalization logic (trigger when all members vote)
  - [ ] Create `useActivities` and `useCastVote` TanStack Query hooks
- [ ] **3. Components & Screens**
  - [ ] Build `ActivityCard` and `VoteChip` UI components
  - [ ] Implement Bottom Sheet for vote casting/breakdown
  - [ ] Implement Activity List screen and Activity Detail screen

---

## 🏠 Phase 4a: Accommodations
*Dependencies: Phase 3*
*Goal: Suggesting and voting on places to stay.*

- [ ] **1. DB/RLS & Types**
  - [ ] Create `accommodations` and `accommodation_votes` tables + RLS
- [ ] **2. Services & Hooks**
  - [ ] Implement Accommodation CRUD services
  - [ ] Extend existing voting hooks to support accommodation entities
- [ ] **3. Components & Screens**
  - [ ] Build Accommodation specific UI elements (price displays, external link buttons)
  - [ ] Implement Accommodation List and Detail screens

---

## 💸 Phase 4b: Expenses
*Dependencies: Phase 2*
*Goal: Shared cost tracking (No payments, just tracking).*

- [ ] **1. DB/RLS & Types**
  - [ ] Create `expenses` and `expense_splits` tables + RLS
  - [ ] Define currency constants and types
- [ ] **2. Services & Hooks**
  - [ ] Implement Expense creation service
  - [ ] Implement split calculation logic (e.g., divide by selected members)
  - [ ] Create TanStack Query hooks for expenses
- [ ] **3. Components & Screens**
  - [ ] Build `ExpenseListItem` and settlement status badges
  - [ ] Implement Expense List screen
  - [ ] Implement Add Expense Form (React Hook Form + Zod)

---

## 🛒 Phase 5: Realtime Shopping Lists
*Dependencies: Phase 2*
*Goal: Collaborative, real-time list management.*

- [ ] **1. DB/RLS & Types**
  - [ ] Create `shopping_lists` and `shopping_items` tables + RLS
- [ ] **2. Services & Hooks**
  - [ ] Implement List and Item CRUD services
  - [ ] **Realtime Setup:** Implement Supabase Realtime channel subscription for item statuses
  - [ ] Implement reconnection logic and heartbeat handling for realtime
- [ ] **3. Components & Screens**
  - [ ] Build interactive Checkbox/Item components (Optimistic UI required)
  - [ ] Implement Shopping List view

---

## 🍳 Phase 6: Recipes
*Dependencies: Phase 5*
*Goal: Recipe management that pipes directly into shopping lists.*

- [ ] **1. DB/RLS & Types**
  - [ ] Create `recipes` and `recipe_ingredients` tables + RLS
- [ ] **2. Services & Hooks**
  - [ ] Implement Recipe CRUD services
  - [ ] Implement Ingredient-to-Shopping-Item sync logic (Duplicate merging logic)
  - [ ] Create Recipe query hooks
- [ ] **3. Components & Screens**
  - [ ] Implement Recipe List and Detail screens
  - [ ] Implement "Add to Shopping List" action flow

---

## 📅 Phase 7: Calendar
*Dependencies: Phase 2, Phase 3*
*Goal: Timezone-aware visual schedule.*

- [ ] **1. Logic & Utils**
  - [ ] Implement timezone resolution using trip configuration + `dayjs.tz`
- [ ] **2. Components & Screens**
  - [ ] Build visual Calendar primitives (Day blocks, event pills)
  - [ ] Implement Trip Calendar Screen
  - [ ] Implement Global Calendar Screen

---

## 🔔 Phase 8: Notifications
*Dependencies: Phases 3, 4a, 4b, 5*
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

---

## 🗺️ Phase 9: Tours
*Dependencies: Phase 3*
*Goal: Grouping activities into organized sequences.*

- [ ] **1. DB/RLS & Types**
  - [ ] Create `tours` and `tour_activities` join table + RLS
- [ ] **2. Services & Hooks**
  - [ ] Implement Tour CRUD and activity linking/ordering services
- [ ] **3. Components & Screens**
  - [ ] Implement Tour List and detail screens

---

## ✨ Phase 10: Polish & Hardening
*Dependencies: All previous phases*
*Goal: Production readiness.*

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

---

## 💡 How to Prompt Claude with this Checklist

When you are ready to start a task, copy the specific sub-item and format your prompt like this:

> **Role:** You are the senior engineer for Vacationist.
> **Context:** React Native, Expo Router, Supabase, TanStack Query, Zustand, NativeWind. Read `software_engineering_guide.md` for standards.
> **Task:** We are on Phase X, Step Y: [Insert Checkbox Task Here].
> **Requirements:** [List specific constraints from the guide]
> **Deliverables:** Provide the exact code for this layer only. Do not build the frontend yet.