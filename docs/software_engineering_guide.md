# Vacationist – Software Engineering Guide (Claude Opus 4.6)

# Purpose of This Document

This document defines the technical architecture, development strategy, project structure, product logic, and engineering standards for building Vacationist V1.

The guide is specifically designed to:
- build the product collaboratively with Claude Opus 4.6
- ship a stable and production-ready MVP
- control technical complexity early
- allow future scalability
- avoid overengineering

---

# 1. Product Definition

## Product Name
Vacationist

---

## Product Description

Vacationist is a mobile-first collaborative travel and leisure planning platform.

The app enables groups to:
- plan trips together
- compare accommodations
- organize activities
- split expenses
- create day plans
- manage shared calendars
- organize shopping lists and recipes

Vacationist is:
- NOT a booking platform
- NOT a maps application
- NOT a messenger
- NOT a social network
- NOT a payment platform

Instead, it is:

> The collaborative operating system for group travel and activities.

---

## Primary Users

Vacationist is designed for:

- **Age range:** Mid 20s to late 30s
- **Profile:** Young professionals and friend groups who travel together regularly
- **Behavior:** Mobile-native, comfortable with collaborative apps, expect fast and intuitive UX
- **Pain points:** Coordination chaos in WhatsApp groups, scattered spreadsheets, back-and-forth decision making
- **Context of use:** Primarily used while planning from home, also referenced during the trip itself

This demographic expects:
- Clean, modern UI (not enterprise-like)
- Low friction interactions
- Fast feedback
- Collaborative features that feel natural, not forced

---

# 2. Technical Stack

## Frontend
- React Native
- Expo
- TypeScript
- NativeWind
- Expo Router
- Zustand
- TanStack Query
- React Hook Form
- Zod

---

## Backend
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Realtime
- Supabase Storage
- Edge Functions (optional)

---

## Hosting
- Vercel (Web)
- Expo EAS
- Supabase Cloud

---

## APIs
- No heavy third-party API integrations in V1
- Only deep links and external URL redirects

---

## Push Notifications
- Expo Notifications

---

## Analytics (Optional)
- PostHog

---

## Design Foundation

Vacationist uses NativeWind as its styling engine, built on top of a clearly defined design token system.

### Color Palette

```txt
Background:       #0F0F0F   (Deep Black – primary app background)
Surface:          #1A1A1A   (Slightly lighter – cards, sheets, panels)
Surface Elevated: #242424   (Modals, dropdowns, elevated elements)
Border:           #2E2E2E   (Subtle separators)
Primary:          #6C63FF   (Violet – main interactive color)
Primary Light:    #8A84FF   (Hover states, soft accents)
Primary Muted:    #6C63FF1A (10% opacity – backgrounds of badges, chips)
Success:          #3ECF8E   (Confirm, settled expenses, completed)
Warning:          #F5A623   (Pending, reminders)
Danger:           #FF5C5C   (Destructive actions, errors)
Text Primary:     #F2F2F2   (Main readable text)
Text Secondary:   #A0A0A0   (Supporting labels, metadata)
Text Muted:       #5C5C5C   (Disabled, placeholder)
```

### Typography

```txt
Font Family:     System default – SF Pro (iOS) / Roboto (Android)
Heading XL:      28px / Bold / Text Primary
Heading L:       22px / SemiBold / Text Primary
Heading M:       18px / SemiBold / Text Primary
Body:            15px / Regular / Text Primary
Body Small:      13px / Regular / Text Secondary
Label:           12px / Medium / Text Muted (uppercase, spaced)
```

### Spacing Scale

```txt
xs:   4px
sm:   8px
md:   16px
lg:   24px
xl:   32px
2xl:  48px
3xl:  64px
```

### Border Radius

```txt
sm:   6px   (inputs, chips)
md:   12px  (cards, list items)
lg:   20px  (bottom sheets, modals)
full: 9999px (avatar, pill badges)
```

### NativeWind Token Mapping

All design tokens must be registered in `tailwind.config.js` as custom theme extensions. Colors should be referenced as `bg-surface`, `text-primary`, `border-border`, etc. Never use raw hex codes inside component files.

---

## Zustand vs TanStack Query – Clear Boundary

This boundary is strict and must never be mixed.

### TanStack Query handles:
- All server-sourced data (trips, activities, accommodations, expenses, votes, shopping lists, members)
- Fetching, caching, refetching, background updates
- Optimistic updates for mutations
- Pagination

### Zustand handles:
- Authenticated user session (id, name, avatar, role in current trip)
- UI-only state: active tab, bottom sheet open/closed, selected trip context
- Theme preference
- Transient notification state (e.g., toast queue)

### Rules:
- Never store server data in Zustand
- Never fetch from the database inside a Zustand action
- If a piece of state needs to be refetched or cached, it belongs in TanStack Query
- Zustand state should be resettable on logout

---

## Date Handling Strategy

All date and time logic must use **`dayjs`** with the following plugins:

```txt
dayjs/plugin/utc
dayjs/plugin/timezone
dayjs/plugin/duration
dayjs/plugin/relativeTime
dayjs/plugin/localizedFormat
```

### Rules:
- All dates are stored in the database as UTC timestamps
- Dates are converted to the trip's configured timezone only at render time
- Never store local device timezone-shifted dates
- Use `dayjs.utc()` when writing to the database
- Use `dayjs().tz(trip.timezone)` when displaying to the user
- `dayjs` must be initialized once globally in the app entrypoint with all required plugins

---

# 3. Core Architecture Principles

# MOST IMPORTANT RULE

Vacationist must NOT become an overengineered system.

The biggest risks are:
- too many features
- too many dependencies
- excessive realtime processing
- chaotic data structures

Therefore:

## Architecture Principles

### 1. Mobile-First
Every feature and workflow should be designed for smartphones first.

---

### 2. Simplicity Over Cleverness
Avoid unnecessarily clever architecture.

---

### 3. Feature Modularity
Each feature should contain:
- its own components
- hooks
- services
- types
- database queries

---

### 4. Backend-Light
Supabase should handle:
- authentication
- realtime
- database
- storage

Do not build complex backend infrastructure for V1.

---

### 5. No Microservices
A modular monorepo structure is sufficient.

---

### 6. Database-First Thinking
Vacationist is highly relational.

The data model determines whether the app stays maintainable or becomes chaotic.

---

### 7. Error Handling and Network Resilience

Vacationist does NOT support offline mode in V1.

However, the app must handle network failures gracefully at all times.

#### Global Error Boundary

Every top-level screen must be wrapped in a React Error Boundary. Uncaught render errors must show a friendly fallback screen, never a blank or crashed view.

#### Network Request Failures

Every TanStack Query operation must define:
- `retry: 2` (automatic retry for transient failures)
- `onError` handler per mutation that shows a dismissible toast notification

#### Connectivity Loss

- Use `@react-native-community/netinfo` to monitor connectivity
- When connection is lost, show a persistent non-blocking banner: "You're offline – changes may not save"
- When connection is restored, automatically trigger a refetch of active queries
- Pending mutations that fail due to connectivity must surface a user-visible error with a "Try again" action

#### Supabase Realtime Disconnection

See Section 8 for reconnection logic specific to Supabase Realtime channels.

#### User-Facing Error Messages

- Never expose raw error messages or stack traces to the user
- Define a global error mapping utility that translates Supabase and network errors into human-readable strings
- Always provide a recovery action where possible (retry, go back, refresh)

---

# 4. Project Structure

## Recommended Monorepo Structure

```txt
/apps
  /mobile
  /web

/packages
  /ui
  /types
  /utils
  /api

/supabase
  /migrations
  /functions

/docs
```

---

## Package Definitions

### `/packages/ui`
Shared design system components built with NativeWind. Includes primitives: Button, Card, Badge, Avatar, Input, BottomSheet, Skeleton, Toast.

### `/packages/types`
All shared TypeScript types and Zod schemas. These types are generated from or aligned with the Supabase database schema. This package is the single source of truth for data shape across frontend features.

### `/packages/utils`
Pure utility functions: date formatting, currency formatting, string helpers, URL validation, invite token generation.

### `/packages/api`
The Supabase client layer. Responsibilities:
- Initializes and exports the typed Supabase client using `@supabase/supabase-js` with full TypeScript types generated from the database schema
- Contains all raw Supabase query functions, organized by domain (e.g., `tripQueries.ts`, `activityQueries.ts`)
- Does NOT contain TanStack Query hooks — those live in the feature folders
- Does NOT contain business logic — only data access
- Is the only place in the codebase that imports and uses the Supabase client directly

This strict isolation ensures that the Supabase client is never scattered across the codebase and is always replaceable.

---

## Mobile App Structure

```txt
/src
  /app
  /components
  /features
  /hooks
  /services
  /stores
  /types
  /utils
  /constants
```

---

## Feature Structure

```txt
/features
  /trips
  /activities
  /accommodations
  /expenses
  /calendar
  /shopping
  /recipes
  /notifications
  /auth
```

Each feature should contain:

```txt
/components
/hooks
/services
/types
/screens
/utils
```

---

# 5. Database Architecture

# IMPORTANT

Vacationist must be designed around PostgreSQL.

Not frontend-first.

---

## Soft Delete Strategy

The following tables use `deleted_at TIMESTAMPTZ DEFAULT NULL` instead of hard deletes:
- `trips`
- `activities`
- `accommodations`
- `expenses`
- `shopping_items`

All queries on these tables must filter `WHERE deleted_at IS NULL` unless explicitly querying history.

Tables that do NOT use soft deletes (rows are fully removed):
- `trip_members` (leaving a trip is a clean removal)
- `votes` (re-voting replaces the previous row via upsert)
- `tour_activities` (relational join table)
- `recipe_ingredients` (tightly coupled to recipe lifecycle)

---

## Core Entities

### users

```sql
id              UUID PRIMARY KEY
name            TEXT NOT NULL
email           TEXT UNIQUE
avatar_url      TEXT
locale          TEXT DEFAULT 'de-DE'
timezone        TEXT DEFAULT 'Europe/Berlin'
is_guest        BOOLEAN DEFAULT FALSE
created_at      TIMESTAMPTZ DEFAULT NOW()
```

---

### trips

```sql
id              UUID PRIMARY KEY
title           TEXT NOT NULL
description     TEXT
start_date      DATE NOT NULL
end_date        DATE NOT NULL
budget_per_person NUMERIC(10,2)
base_currency   TEXT DEFAULT 'EUR' CHECK (base_currency IN ('EUR', 'CHF'))
timezone        TEXT DEFAULT 'Europe/Berlin'
status          TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'archived'))
created_by      UUID REFERENCES users(id)
created_at      TIMESTAMPTZ DEFAULT NOW()
deleted_at      TIMESTAMPTZ DEFAULT NULL
```

Status values:
- `planning` – trip is being organized, not yet started
- `active` – trip is currently happening
- `completed` – trip has ended, data is read-only
- `archived` – hidden from main lists, preserved for history

---

### trip_members

```sql
id              UUID PRIMARY KEY
trip_id         UUID REFERENCES trips(id) ON DELETE CASCADE
user_id         UUID REFERENCES users(id) ON DELETE CASCADE
role            TEXT CHECK (role IN ('organizer', 'participant', 'guest'))
joined_at       TIMESTAMPTZ DEFAULT NOW()
UNIQUE (trip_id, user_id)
```

Role values:
- `organizer`
- `participant`
- `guest`

---

### invite_tokens

```sql
id              UUID PRIMARY KEY
trip_id         UUID REFERENCES trips(id) ON DELETE CASCADE
token           TEXT UNIQUE NOT NULL
created_by      UUID REFERENCES users(id)
expires_at      TIMESTAMPTZ NOT NULL
used_at         TIMESTAMPTZ DEFAULT NULL
revoked_at      TIMESTAMPTZ DEFAULT NULL
max_uses        INT DEFAULT NULL
use_count       INT DEFAULT 0
created_at      TIMESTAMPTZ DEFAULT NOW()
```

---

### accommodations

```sql
id              UUID PRIMARY KEY
trip_id         UUID REFERENCES trips(id) ON DELETE CASCADE
title           TEXT NOT NULL
description     TEXT
price_total     NUMERIC(10,2)
external_url    TEXT
notes           TEXT
status          TEXT DEFAULT 'suggested' CHECK (status IN ('suggested', 'requested', 'reserved', 'booked', 'completed'))
voting_open     BOOLEAN DEFAULT TRUE
created_by      UUID REFERENCES users(id)
created_at      TIMESTAMPTZ DEFAULT NOW()
deleted_at      TIMESTAMPTZ DEFAULT NULL
```

Status values:
- `suggested`
- `requested`
- `reserved`
- `booked`
- `completed`

---

### accommodation_votes

```sql
id                  UUID PRIMARY KEY
accommodation_id    UUID REFERENCES accommodations(id) ON DELETE CASCADE
user_id             UUID REFERENCES users(id) ON DELETE CASCADE
vote                TEXT CHECK (vote IN ('must_do', 'like', 'open', 'skip', 'group_blocker'))
created_at          TIMESTAMPTZ DEFAULT NOW()
UNIQUE (accommodation_id, user_id)
```

Vote enum:

```txt
must_do
like
open
skip
group_blocker
```

---

### activities

```sql
id              UUID PRIMARY KEY
trip_id         UUID REFERENCES trips(id) ON DELETE CASCADE
title           TEXT NOT NULL
description     TEXT
category        TEXT
cost_estimate   NUMERIC(10,2)
activity_date   DATE
start_time      TIME
end_time        TIME
external_url    TEXT
maps_url        TEXT
status          TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'reserved', 'completed', 'skipped'))
voting_open     BOOLEAN DEFAULT TRUE
created_by      UUID REFERENCES users(id)
created_at      TIMESTAMPTZ DEFAULT NOW()
deleted_at      TIMESTAMPTZ DEFAULT NULL
```

Note: `activity_date` is a plain DATE. `start_time` and `end_time` are TIME values without timezone. The trip's configured `timezone` (from the `trips` table) is used to interpret and display these values correctly.

Status values:
- `planned`
- `reserved`
- `completed`
- `skipped`

---

### activity_votes

```sql
id              UUID PRIMARY KEY
activity_id     UUID REFERENCES activities(id) ON DELETE CASCADE
user_id         UUID REFERENCES users(id) ON DELETE CASCADE
vote            TEXT CHECK (vote IN ('must_do', 'like', 'open', 'skip', 'group_blocker'))
created_at      TIMESTAMPTZ DEFAULT NOW()
UNIQUE (activity_id, user_id)
```

---

### tours

A collection of multiple linked activities.

```sql
id              UUID PRIMARY KEY
trip_id         UUID REFERENCES trips(id) ON DELETE CASCADE
title           TEXT NOT NULL
description     TEXT
created_by      UUID REFERENCES users(id)
created_at      TIMESTAMPTZ DEFAULT NOW()
```

---

### tour_activities

```sql
id              UUID PRIMARY KEY
tour_id         UUID REFERENCES tours(id) ON DELETE CASCADE
activity_id     UUID REFERENCES activities(id) ON DELETE CASCADE
sort_order      INT NOT NULL
UNIQUE (tour_id, activity_id)
```

---

### expenses

```sql
id              UUID PRIMARY KEY
trip_id         UUID REFERENCES trips(id) ON DELETE CASCADE
related_type    TEXT CHECK (related_type IN ('accommodation', 'activity', 'transport', 'shopping', 'manual'))
related_id      UUID
title           TEXT NOT NULL
amount          NUMERIC(10,2) NOT NULL
currency        TEXT DEFAULT 'EUR' CHECK (currency IN ('EUR', 'CHF'))
paid_by         UUID REFERENCES users(id)
created_by      UUID REFERENCES users(id)
created_at      TIMESTAMPTZ DEFAULT NOW()
archived_at     TIMESTAMPTZ DEFAULT NULL
```

`currency` must match or align with `trips.base_currency`. Display is always normalized to the trip's base currency.

`related_type` values:
- `accommodation`
- `activity`
- `transport`
- `shopping`
- `manual`

---

### expense_splits

```sql
id              UUID PRIMARY KEY
expense_id      UUID REFERENCES expenses(id) ON DELETE CASCADE
user_id         UUID REFERENCES users(id)
amount_owed     NUMERIC(10,2) NOT NULL
status          TEXT DEFAULT 'open' CHECK (status IN ('open', 'settled'))
```

Status values:
- `open`
- `settled`

---

### shopping_lists

```sql
id              UUID PRIMARY KEY
trip_id         UUID REFERENCES trips(id) ON DELETE CASCADE
title           TEXT NOT NULL
created_by      UUID REFERENCES users(id)
created_at      TIMESTAMPTZ DEFAULT NOW()
```

---

### shopping_items

```sql
id                  UUID PRIMARY KEY
shopping_list_id    UUID REFERENCES shopping_lists(id) ON DELETE CASCADE
title               TEXT NOT NULL
quantity            NUMERIC(10,2)
unit                TEXT
status              TEXT DEFAULT 'open' CHECK (status IN ('open', 'bought', 'consumed', 'completed'))
source_recipe_id    UUID REFERENCES recipes(id) ON DELETE SET NULL
created_by          UUID REFERENCES users(id)
deleted_at          TIMESTAMPTZ DEFAULT NULL
```

`source_recipe_id` tracks which recipe generated this item, if any. Nullable — items created directly have no recipe source.

Status values:
- `open`
- `bought`
- `consumed`
- `completed`

---

### recipes

```sql
id              UUID PRIMARY KEY
trip_id         UUID REFERENCES trips(id) ON DELETE CASCADE
title           TEXT NOT NULL
description     TEXT
servings        INT DEFAULT 4
created_by      UUID REFERENCES users(id)
```

---

### recipe_ingredients

```sql
id              UUID PRIMARY KEY
recipe_id       UUID REFERENCES recipes(id) ON DELETE CASCADE
title           TEXT NOT NULL
quantity        NUMERIC(10,2)
unit            TEXT
```

---

### notifications

```sql
id              UUID PRIMARY KEY
trip_id         UUID REFERENCES trips(id) ON DELETE CASCADE
user_id         UUID REFERENCES users(id) ON DELETE CASCADE
type            TEXT NOT NULL CHECK (type IN ('new_activity', 'vote_update', 'expense_change', 'new_member', 'schedule_change', 'reminder', 'vote_finalized'))
title           TEXT NOT NULL
body            TEXT
related_type    TEXT
related_id      UUID
is_read         BOOLEAN DEFAULT FALSE
created_at      TIMESTAMPTZ DEFAULT NOW()
```

---

### notification_preferences

```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users(id) ON DELETE CASCADE
trip_id         UUID REFERENCES trips(id) ON DELETE CASCADE
new_activity    BOOLEAN DEFAULT TRUE
vote_update     BOOLEAN DEFAULT TRUE
expense_change  BOOLEAN DEFAULT TRUE
new_member      BOOLEAN DEFAULT TRUE
schedule_change BOOLEAN DEFAULT TRUE
reminder        BOOLEAN DEFAULT TRUE
UNIQUE (user_id, trip_id)
```

---

# 6. Voting System Architecture

# IMPORTANT

Votes must NOT be modeled numerically.

WRONG:

```txt
A = 5
B = 4
```

CORRECT:

```txt
must_do
like
open
skip
group_blocker
```

---

## Vacationist Vote Semantics

### must_do
"This is a highlight for me."

---

### like
"I think this is a great idea."

---

### open
"I'm open to it."

---

### skip
"Not my thing, but the group can still do it."

---

### group_blocker
"This creates organizational or group-level issues."

---

# IMPORTANT

skip != group_blocker

This distinction is a core principle of the app.

---

## Voting Finalization

Voting on an activity or accommodation is considered finalized when either of the following conditions is met:

### Condition A – Organizer Ends Voting
The organizer explicitly closes the vote by setting `voting_open = FALSE` on the activity or accommodation. This immediately ends the voting phase regardless of how many members have voted.

### Condition B – All Members Have Voted
When every `trip_members` entry for the given trip has a corresponding vote row for the item, the voting phase is automatically finalized. This is evaluated server-side after each new vote insert.

### After Finalization
- `voting_open` is set to `FALSE`
- A notification of type `vote_finalized` is dispatched to all trip members
- The vote summary (breakdown by vote type) becomes visible to all participants
- The organizer may then take action based on the result (e.g., change `status` to `reserved`)

### Vote Summary Display Logic
During active voting: members see only their own vote to avoid influence.
After finalization: full vote breakdown is visible to all members.

---

# 7. Frontend Architecture

## Navigation

### Expo Router

Recommended structure:

```txt
/app
  /(auth)
  /(tabs)
  /trip
  /activity
  /expense
```

---

## State Management

### Zustand

Use only for:
- user session
- UI state
- theme
- lightweight global app state

NOT for server state.

---

## Server State

### TanStack Query

ALL server data should use query caching:
- trips
- activities
- expenses
- votes
- shopping lists

---

## Forms

### React Hook Form + Zod

Validation should be:
- centralized
- type-safe
- schema-driven

---

## Styling

### NativeWind

Why:
- fast development
- consistent UI
- ideal for mobile-first design

---

## Error Boundaries

Every top-level screen must be wrapped in a `<ScreenErrorBoundary>` component.

Behavior:
- Catches unhandled render errors
- Shows a friendly fallback with a "Reload screen" button
- Never shows raw error messages or stack traces to the user
- Logs errors to the analytics provider (PostHog) if enabled

A `<GlobalErrorBoundary>` wraps the entire navigation tree as a last-resort fallback.

---

## Loading States

### Rules:
- Every screen that depends on async data must have a defined loading state
- Use skeleton screens, not spinners, for initial data loads
- Use inline loading indicators for refetch operations only (e.g., pull-to-refresh spinner)
- Never show a full-page loading spinner unless the operation takes longer than 800ms
- TanStack Query's `isLoading` vs `isFetching` distinction must be used correctly: skeletons for `isLoading`, subtle indicators for `isFetching`

---

## Skeleton Screens

Each major screen must have a skeleton variant that mirrors the exact layout of the loaded state.

Required skeleton screens:
- `TripListSkeleton` – list of trip cards
- `TripDetailSkeleton` – trip header + tab bar
- `ActivityListSkeleton` – list of activity items
- `AccommodationListSkeleton`
- `ExpenseListSkeleton`
- `ShoppingListSkeleton`

Skeleton components use an animated shimmer effect. They are implemented as reusable primitives in `/packages/ui` and composed into screen-specific layouts.

---

## Toast Notifications (In-App)

All user-facing feedback for mutations (success, error, warning) must use a centralized toast system.

- Toast appears at the top of the screen on mobile
- Auto-dismisses after 3 seconds for success, requires manual dismiss for errors
- Toasts are queued and never stacked more than 2 deep
- Stored transiently in Zustand (`toastStore`)

---

# 8. Realtime Architecture

## V1 Realtime Scope

Realtime should only be used for:
- shopping lists
- votes
- expense updates
- activity updates

NOT for:
- live locations
- complex presence systems
- chat

---

## Supabase Realtime

Only subscribe to tables that truly require realtime updates.

Too many listeners will hurt performance.

---

## Reconnection Logic

Supabase Realtime channels can disconnect silently. Vacationist must handle this reliably.

### Reconnection Strategy:

1. All realtime channels must be initialized with the `heartbeat` option enabled
2. Use Supabase's built-in channel status listener: `channel.on('system', ..., (status) => ...)` to detect `CHANNEL_ERROR` and `TIMED_OUT` states
3. On disconnection detected, attempt to re-subscribe after a delay of 2 seconds
4. Implement exponential backoff: 2s → 5s → 10s → 30s maximum
5. After reconnection, trigger a manual refetch via TanStack Query to reconcile any missed updates during the offline window
6. Show a non-blocking offline indicator banner while realtime is disconnected (see Section 3)
7. On app foreground (AppState change from background → active), always force channel re-subscription

---

## Conflict Resolution

When two users modify the same data simultaneously, conflicts must be resolved deterministically.

### Strategy: Last-Write-Wins with Optimistic UI

- All mutations use TanStack Query's `useMutation` with `onMutate` for optimistic updates
- On conflict, the server response is always considered authoritative
- Optimistic updates are rolled back on mutation error via `onError` with the previous snapshot
- For shopping list items specifically: item status updates use `upsert` semantics (keyed on `id`) to avoid duplicate rows

### Shopping List Concurrent Edit Policy:
- Item status (open → bought) is the most common concurrent action
- Status changes are idempotent: setting an already-bought item to `bought` again has no effect
- Title and quantity edits are protected: if two users edit simultaneously, the last server-confirmed write wins and the other user sees a toast: "Item was updated by another member"

### Vote Conflict Policy:
- Votes use `UPSERT` keyed on `(entity_id, user_id)` — only one vote per user per item
- Re-voting always replaces the previous vote
- No merge conflict is possible

---

# 9. Authentication

## Supabase Auth

Authentication methods:
- Google OAuth
- Magic Links
- Guest access via invite links

---

## Invite System

# IMPORTANT

Trip invitations should use:

```txt
invite_token
```

Never expose public IDs.

---

## Role Logic

### organizer
Can:
- add/remove participants
- manage trips
- delete activities
- generate invite links
- end voting on any item
- archive the trip

---

### participant
Can:
- edit content
- vote
- create activities
- manage expenses
- manage shopping lists
- delete their own created content

---

### guest

Guests access Vacationist via an invite link without creating a full account. They are assigned a temporary identity stored in `users` with `is_guest = TRUE`.

#### Guest Capabilities:
- View all trip content (activities, accommodations, expenses, schedules)
- Cast votes on activities and accommodations
- Add expenses and expense splits
- Create activities, accommodations, and shopping list items
- Manage shopping list item status (open → bought, etc.)

#### Guest Restrictions:
- Cannot delete any content (including their own)
- Cannot generate invite links
- Cannot remove other participants
- Cannot end voting
- Cannot archive or delete the trip
- Cannot change the trip's base settings (dates, title, budget)

#### Guest Identity:
- Guests are assigned a generated display name (e.g., "Guest · Marco") at invite link entry
- They can optionally set a name before joining
- Guest sessions are tied to the device via Expo SecureStore token
- Guests can upgrade to a full account at any time, preserving all their contributed data

#### Guest Data Retention:
- Guest user records are retained for 90 days after the trip end date
- After 90 days, guest users and their associated content are anonymized (name → "Former Guest")
- Their votes and expenses are preserved for data integrity

---

# 10. Push Notifications

## Expo Notifications

Notifications for:
- new activities
- votes
- expense changes
- new participants
- schedule changes
- reminders
- vote finalized

---

# IMPORTANT

Do not send a notification for every single action.

Otherwise:
- notification spam
- poor UX

---

## Recommendation

Use batching.

Example:

NOT:
- 5 separate notifications

INSTEAD:
- "3 new activities were added."

---

## Notification Preferences

### Default State
All notification categories are **enabled by default** for every user and guest upon joining a trip.

### Opt-Out Behavior
Users and guests can toggle individual notification categories per trip.

Available categories:
- New activities
- Vote updates
- Expense changes
- New members
- Schedule changes
- Reminders

### Preference Storage
Preferences are stored in the `notification_preferences` table (see Section 5), keyed by `user_id` and `trip_id`.

A row is created automatically when a user joins a trip, with all categories defaulting to `TRUE`.

### Who Can Change Preferences
- Organizers can adjust their own preferences
- Participants can adjust their own preferences
- Guests can adjust their own preferences
- No one can change another member's preferences

### Preference UI
Accessible via the trip settings screen under "Notifications for this trip". A simple toggle list per category.

---

# 11. Expense System Architecture

# IMPORTANT

Vacationist does NOT process payments.

The system only handles:
- expense tracking
- debt calculation
- shared cost management

---

## Base Currency

Every trip must have a base currency defined at creation.

```txt
Default: EUR (Euro)
Alternative: CHF (Swiss Franc)
```

The base currency cannot be changed after the first expense is added to the trip.

All expenses are recorded in the trip's base currency. If a real-world cost was paid in a different currency, the member must manually convert before entering the amount. Vacationist does not perform currency conversion.

Expense display always shows the base currency symbol.

---

## Expense Principle

Every cost-related entity can:
- generate expenses
- generate splits

---

## Example

Accommodation:

```txt
€600
paid by Janine
4 participants
```

Automatically creates:

```txt
€150 per person
```

---

# IMPORTANT

Never hard-delete expenses.

Instead use:

```txt
archived_at
```

Maintaining history is important.

---

# 12. Calendar Architecture

# IMPORTANT

Do not build a complex calendar system.

The calendar is simply:

> A visual representation of trips and activities.

---

## Trip Timezone

Every trip has a configured timezone that defines how all dates and times are displayed within that trip's context.

```txt
Default: Europe/Berlin
```

### Supported European Timezones (V1):

```txt
Europe/Berlin       (Germany, Austria, most of Central Europe)
Europe/London       (United Kingdom, Ireland)
Europe/Paris        (France, Belgium, Luxembourg)
Europe/Rome         (Italy)
Europe/Madrid       (Spain)
Europe/Lisbon       (Portugal)
Europe/Amsterdam    (Netherlands)
Europe/Zurich       (Switzerland)
Europe/Vienna       (Austria)
Europe/Warsaw       (Poland)
Europe/Prague       (Czech Republic)
Europe/Stockholm    (Sweden, Norway, Denmark)
Europe/Helsinki     (Finland, Estonia)
Europe/Athens       (Greece, Bulgaria)
Europe/Bucharest    (Romania)
Europe/Budapest     (Hungary)
Europe/Istanbul     (Turkey)
```

No other timezones are supported in V1.

The timezone is set once at trip creation and cannot be changed after activities have been added.

All `activity_date`, `start_time`, and `end_time` values are stored without timezone in the database and are interpreted within the trip's configured timezone at render time using `dayjs.tz()`.

---

## Calendar Views

### Trip Calendar
Only displays the current trip.

---

### Global Calendar
Displays all shared events.

---

## No External Sync in V1

No:
- Google Calendar sync
- Apple Calendar sync
- Outlook sync

---

# 13. Shopping & Recipe System

## Core Principle

Recipes generate shopping items.

---

## Flow

```txt
Create recipe
→ Define ingredients
→ Automatically add ingredients to shopping list
```

---

# IMPORTANT

Shopping items must:
- remain editable by the user
- auto-sync with their source recipe ingredient when it changes

---

## Duplicate Ingredient Handling

When a recipe is added to a shopping list and one or more of its ingredients already exist as items in that list, the following rules apply:

### Matching Logic
Two items are considered duplicates if their `title` matches case-insensitively AND their `unit` matches (or both have no unit).

### Resolution Behavior

**If a match is found:**
- The existing item's `quantity` is incremented by the recipe ingredient's quantity
- The existing item retains its current `status`
- The existing item gains the `source_recipe_id` reference only if it did not already have one
- Merged items do NOT get `source_ingredient_id` set (they are detached from auto-sync)
- A toast is shown: "3 items merged with existing list entries"

**If no match is found:**
- A new `shopping_item` is created with `source_recipe_id` and `source_ingredient_id` set

### Auto-Propagation of Ingredient Changes

When a recipe has been added to one or more shopping lists, subsequent ingredient changes propagate automatically:

- **Ingredient added:** A new shopping item is created in every linked shopping list. The quantity is scaled using the same ratio that was used when the recipe was first added (derived from existing linked items).
- **Ingredient updated (title, quantity, unit):** All shopping items linked via `source_ingredient_id` are updated with the new values (quantity is scaled).
- **Ingredient deleted:** All shopping items linked via `source_ingredient_id` are soft-deleted (`deleted_at` is set).

The scale factor is derived at propagation time by comparing a linked shopping item's quantity to its source ingredient's quantity. If no scalable pair exists, scale defaults to 1.

Merged items (those without `source_ingredient_id`) are NOT affected by auto-propagation and can be freely edited.

### Recipe Deletion
If a recipe is deleted:
- Its ingredients are NOT removed from the shopping list
- Items with `source_recipe_id` referencing the deleted recipe have that field set to `NULL` (`ON DELETE SET NULL`)
- Items with `source_ingredient_id` referencing deleted ingredients have that field set to `NULL` (`ON DELETE SET NULL`)
- This ensures shopping list continuity even after recipe removal

---

# 14. Deep Links & External URLs

## Supported Links

- Booking.com
- Airbnb
- Google Maps
- websites
- restaurant pages
- ticket links

---

## Expected Behavior

On mobile:
- open the native app if available
- otherwise open the browser

---

# IMPORTANT

Validate URLs.

Do not allow unsafe or unvalidated URL injection.

---

# 15. Security Architecture

# IMPORTANT

Supabase RLS (Row Level Security) MUST be implemented correctly.

---

## RLS Rules

Users may:
- only view trips they belong to
- only access groups where membership exists

---

## Critical Tables

RLS is especially important for:
- expenses
- votes
- participants
- invite tokens

---

## Never Trust

Never rely on:
- frontend-only role checks

Always enforce permissions at the database level.

---

## Invite Token Security

Invite tokens must be treated as sensitive credentials.

### Token Generation
- Tokens are generated as cryptographically random UUIDs or 32-character hex strings (use `crypto.randomUUID()` or equivalent)
- Tokens are never derived from predictable values (user id, timestamp, trip id)

### Token Expiry
- Every invite token has a mandatory `expires_at` timestamp
- Default expiry: **7 days** from creation
- Organizers may choose shorter expiry windows: 1 hour, 24 hours, 7 days
- Expired tokens must be rejected server-side via RLS policy and/or Edge Function validation
- Expired tokens are never cleaned up on the frontend — expiry is always enforced server-side

### Token Revocation
- Organizers can revoke any active token at any time
- Revoked tokens set `revoked_at = NOW()`
- Revoked tokens are rejected with the same error as expired tokens (no information leakage)

### Token Use Limits
- `max_uses` can optionally cap the number of times a token can be used
- `use_count` is incremented atomically on each valid use
- Once `use_count >= max_uses`, the token is rejected

### Token Exposure
- Tokens are never stored in plain URLs in logs, analytics events, or error reports
- Invite links take the form: `vacationist://join?token=<token>` — the token is the only parameter

---

## Input Sanitization

- All user-submitted text (titles, descriptions, notes, URLs) must be validated server-side
- URL fields (external_url, maps_url) must be validated against an allowlist of safe schemes (`https://` only)
- No raw HTML is accepted or rendered anywhere in the app
- Zod schemas must enforce maximum string lengths on all text inputs:

```txt
title:        max 100 characters
description:  max 1000 characters
notes:        max 500 characters
url:          max 2048 characters
```

---

## Rate Limiting

- Invite token generation is rate-limited: max 10 tokens per organizer per trip per hour
- Vote submissions are rate-limited: max 60 votes per user per hour per trip (prevents automated abuse)
- Rate limiting is enforced via Supabase Edge Functions or RLS helper functions
- Clients that exceed rate limits receive a `429` response with a human-readable message

---

# 16. Performance Strategy

# IMPORTANT

Vacationist can become data-heavy very quickly.

---

## Rules

### 1. Avoid Massive Nested Queries

---

### 2. Implement Pagination Early

---

### 3. Use Lazy Loading

---

### 4. Use Realtime Sparingly

---

### 5. Virtualize Large Lists

---

# 17. UX Principles

# EXTREMELY IMPORTANT

The success of the product heavily depends on UX quality.

---

## Principles

### 1. Mobile-First

---

### 2. Minimize Clicks

---

### 3. Large Touch Targets

---

### 4. Prefer Bottom Sheets

---

### 5. Avoid UI Overload

---

### 6. Progressive Disclosure

Show basics first.
Advanced details should appear later.

---

# 18. Design System

## Visual Philosophy

Vacationist targets users in their mid-20s to late 30s who are familiar with modern apps like Linear, Notion, and Airbnb. The UI should feel:

- **Dark-native** — the primary experience is dark mode; light mode is secondary
- **Spacious** — content breathes; no cramped layouts
- **Precise** — clean type, consistent spacing, no decorative clutter
- **Collaborative** — visual indicators of group presence and shared state

Avoid:
- Overly playful or cartoon-like elements
- Cluttered interfaces with excessive icons
- Social media aesthetics
- Enterprise grid-heavy layouts

---

## Color System

See Section 2 for the full color palette definition.

All colors are registered as NativeWind theme tokens. No hardcoded hex values in component files.

### Semantic Usage Guide:

```txt
Backgrounds:       bg-background (screens), bg-surface (cards), bg-surface-elevated (sheets)
Interactive:       bg-primary (buttons, active tabs), text-primary (links, actions)
Status – Success:  text-success, bg-success/10
Status – Warning:  text-warning, bg-warning/10
Status – Error:    text-danger, bg-danger/10
Text hierarchy:    text-text-primary, text-text-secondary, text-text-muted
Borders:           border-border
```

---

## Component Standards

### Buttons

Three variants:
- **Primary** – solid violet background, white label, 12px radius, 48px height minimum
- **Secondary** – transparent background, violet border, violet label
- **Ghost** – no border, no background, used for inline actions only

All buttons: minimum 48px touch target height.

---

### Cards

- Background: `bg-surface`
- Border: `border border-border`
- Radius: `rounded-md` (12px)
- Padding: `p-md` (16px)
- Shadow: none (flat design)

---

### Bottom Sheets

Used for: creating items, editing details, viewing vote breakdowns, confirmation actions.

- Background: `bg-surface-elevated`
- Top radius: `rounded-t-lg` (20px)
- Handle bar: 4px × 36px, color `bg-border`, centered
- Drag-to-dismiss: enabled
- Backdrop: `bg-background/80` with blur

---

### Vote Chips

Visual representation of vote types. Each vote has a distinct color:

```txt
must_do:        bg-success/20   text-success    icon: ⭐
like:           bg-primary/20   text-primary    icon: 👍
open:           bg-border/50    text-secondary  icon: 🤷
skip:           bg-warning/20   text-warning    icon: ➡️
group_blocker:  bg-danger/20    text-danger     icon: 🚫
```

---

### Skeleton Screens

Skeleton shimmer uses:
- Base color: `bg-surface`
- Highlight color: `bg-surface-elevated`
- Animation: left-to-right shimmer, 1.2s loop

---

### Status Badges

Compact pill badges for activity and accommodation status:

```txt
planning:   bg-primary/10   text-primary
active:     bg-success/10   text-success
completed:  bg-border/50    text-muted
archived:   bg-border/20    text-muted
```

---

## Motion and Interaction

- Screen transitions: native Expo Router slide/fade defaults
- Bottom sheet: spring animation, natural feel
- Vote selection: subtle scale pulse on tap (scale 0.95 → 1.0)
- Skeleton: linear shimmer only, no bounce or spin
- Toasts: slide in from top, fade out

No excessive animations. Motion must serve function, not decorate.

---

# 19. Development Strategy with Claude Opus 4.6

# IMPORTANT

Do NOT ask Claude to build the entire app at once.

This leads to:
- chaos
- inconsistent architecture
- low maintainability

---

## CORRECT APPROACH

### Build Feature-by-Feature

For every feature:

1. Database model
2. Type definitions
3. Services
4. Queries
5. UI components
6. Screens
7. Realtime integration
8. Testing

---

## Implementation Order and Dependency Graph

The following order is mandatory. A feature must not be started until all its listed dependencies are complete.

```txt
[Foundation]
  ┌─────────────────────────────────────────────────┐
  │  Phase 0: Infrastructure                         │
  │  • Monorepo setup                                │
  │  • Supabase project + DB schema migrations       │
  │  • /packages/api – Supabase client + types       │
  │  • /packages/ui – design tokens + primitives     │
  │  • /packages/types – shared TypeScript types     │
  │  • /packages/utils – dayjs setup, formatting     │
  │  • Expo project + Expo Router structure          │
  │  • NativeWind config + Tailwind theme tokens     │
  │  • Global error boundary + toast system          │
  └─────────────────────────────────────────────────┘
         │
         ▼
[Phase 1: Auth]
  Depends on: Phase 0
  ┌─────────────────────────────────────────────────┐
  │  • Supabase Auth (Google OAuth + Magic Links)    │
  │  • Guest access model                            │
  │  • Invite token system                           │
  │  • users table + RLS                             │
  │  • Session store (Zustand)                       │
  │  • Auth screens: Login, Magic Link, Join Trip    │
  └─────────────────────────────────────────────────┘
         │
         ▼
[Phase 2: Trips]
  Depends on: Phase 1 (Auth)
  ┌─────────────────────────────────────────────────┐
  │  • trips table + RLS                             │
  │  • trip_members table + RLS                      │
  │  • Create / edit / archive trip                  │
  │  • Trip list screen                              │
  │  • Trip detail screen (shell + tab bar)          │
  │  • Member management                             │
  │  • Role enforcement (organizer / participant /   │
  │    guest) in UI and RLS                          │
  └─────────────────────────────────────────────────┘
         │
         ▼
[Phase 3: Activities]
  Depends on: Phase 2 (Trips)
  ┌─────────────────────────────────────────────────┐
  │  • activities table + RLS                        │
  │  • activity_votes table + RLS                    │
  │  • Create / edit / delete activity               │
  │  • Activity list screen                          │
  │  • Activity detail screen                        │
  │  • Voting system (cast + view votes)             │
  │  • Vote finalization logic                       │
  │  • voting_open flag enforcement                  │
  └─────────────────────────────────────────────────┘
         │
         ├──────────────────────────────────┐
         ▼                                  ▼
[Phase 4a: Accommodations]         [Phase 4b: Expenses]
  Depends on: Phase 3               Depends on: Phase 2 (Trips)
  ┌──────────────────────────┐      ┌──────────────────────────┐
  │  • accommodations table  │      │  • expenses table + RLS  │
  │  • accommodation_votes   │      │  • expense_splits        │
  │  • Create / edit /       │      │  • Expense creation      │
  │    archive accommodation │      │  • Split calculation     │
  │  • Voting system         │      │  • Expense list screen   │
  │  • Accommodation list    │      │  • Settlement tracking   │
  │    and detail screens    │      └──────────────────────────┘
  └──────────────────────────┘
         │                                  │
         └──────────────┬───────────────────┘
                        ▼
[Phase 5: Shopping Lists]
  Depends on: Phase 2 (Trips)
  ┌─────────────────────────────────────────────────┐
  │  • shopping_lists + shopping_items tables + RLS  │
  │  • Create / manage lists and items               │
  │  • Realtime subscription (item status changes)   │
  │  • Reconnection logic                            │
  └─────────────────────────────────────────────────┘
         │
         ▼
[Phase 6: Recipes]
  Depends on: Phase 5 (Shopping Lists)
  ┌─────────────────────────────────────────────────┐
  │  • recipes + recipe_ingredients tables + RLS     │
  │  • Create / edit recipes                         │
  │  • Ingredient → shopping list sync               │
  │  • Duplicate merge logic                         │
  └─────────────────────────────────────────────────┘
         │
         ▼
[Phase 7: Calendar]
  Depends on: Phase 3 (Activities), Phase 2 (Trips)
  ┌─────────────────────────────────────────────────┐
  │  • Trip calendar view (activities by date)       │
  │  • Global calendar view (all trips)              │
  │  • Timezone-aware date rendering                 │
  └─────────────────────────────────────────────────┘
         │
         ▼
[Phase 8: Notifications]
  Depends on: Phase 3, Phase 4a, Phase 4b, Phase 5
  ┌─────────────────────────────────────────────────┐
  │  • notifications table + RLS                     │
  │  • notification_preferences + RLS               │
  │  • Expo Notifications setup + token registration │
  │  • Notification dispatch logic (batching)        │
  │  • In-app notification center                    │
  │  • Per-trip preference toggles                   │
  └─────────────────────────────────────────────────┘
         │
         ▼
[Phase 9: Tours]
  Depends on: Phase 3 (Activities)
  ┌─────────────────────────────────────────────────┐
  │  • tours + tour_activities tables + RLS          │
  │  • Create / manage tours                         │
  │  • Link activities to tours                      │
  │  • Tour detail view                              │
  └─────────────────────────────────────────────────┘
         │
         ▼
[Phase 10: Polish & Hardening]
  Depends on: All previous phases
  ┌─────────────────────────────────────────────────┐
  │  • Skeleton screens for all list/detail views    │
  │  • Full RLS audit across all tables              │
  │  • Rate limiting implementation                  │
  │  • Error boundary coverage                       │
  │  • Performance profiling + list virtualization   │
  │  • Guest upgrade flow                            │
  │  • Expo EAS build + OTA update configuration     │
  └─────────────────────────────────────────────────┘
```

### Dependency Summary Table

| Phase | Feature | Hard Dependencies |
|---|---|---|
| 0 | Infrastructure | None |
| 1 | Auth | Phase 0 |
| 2 | Trips | Phase 1 |
| 3 | Activities | Phase 2 |
| 4a | Accommodations | Phase 3 |
| 4b | Expenses | Phase 2 |
| 5 | Shopping Lists | Phase 2 |
| 6 | Recipes | Phase 5 |
| 7 | Calendar | Phase 3, Phase 2 |
| 8 | Notifications | Phase 3, 4a, 4b, 5 |
| 9 | Tours | Phase 3 |
| 10 | Polish | All |

Note: Phases 4a and 4b can be developed in parallel. Phase 5 can also begin in parallel with Phase 4a/4b since it only depends on Phase 2.

---

# 20. How Claude Should Be Used

## Good Claude Tasks

### Example

"Create the complete TypeScript types for the expense system based on the following schema."

---

### Example

"Create a modular React Native screen architecture for activities including TanStack Query hooks."

---

## Bad Claude Tasks

"Build the entire app."

---

# IMPORTANT

Claude should receive:
- clearly scoped tasks
- existing project structure
- explicit conventions

---

# 21. Code Standards

## TypeScript Strict Mode

Always enabled.

---

## Naming Conventions

### Components

```txt
ActivityCard.tsx
```

---

### Hooks

```txt
useActivities.ts
```

---

### Services

```txt
activityService.ts
```

---

### Types

```txt
activity.types.ts
```

---

## No Any Types

Never use:

```ts
any
```

---

# 22. Testing Strategy

## V1 Scope

Only test:
- critical business logic
- core user flows

Avoid overly large testing systems.

---

## Priority Areas

### Test:
- expense splits
- vote logic
- invite permissions
- shopping synchronization

---

## Lower Priority

- visual snapshot tests
- complex end-to-end systems

---

## Recommendation

- Vitest
- React Native Testing Library

---

# 23. Common Mistakes to Avoid

## CRITICAL MISTAKES

### 1. Excessive Realtime Usage

---

### 2. Building Too Many Features Simultaneously

---

### 3. Poor Database Modeling

---

### 4. Business Logic Only in Frontend

---

### 5. Oversized Components

---

### 6. Inconsistent Typing

---

### 7. Notification Spam

---

### 8. Too Many External Integrations

---

# 24. MVP Definition

## Vacationist V1 is successful if:

A group of friends can:
- create a trip
- compare accommodations
- plan activities
- vote collaboratively
- split expenses
- manage shopping lists
- use a shared calendar

WITHOUT:
- WhatsApp chaos
- Google Docs
- spreadsheets
- external Splitwise usage

---

# 25. Long-Term Scalability (NOT V1)

Possible future additions:
- offline support
- map integration
- AI features
- public trip pages
- calendar synchronization
- smart recommendations
- chat
- image uploads
- realtime presence systems

BUT:

NOT in V1.

---

# 26. Final Architecture Philosophy

Vacationist V1 should be:

## Simple
## Stable
## Collaborative
## Fast
## Mobile-First
## Modular

NOT:
- overly complex
- enterprise-heavy
- AI-centric
- integration overloaded

---

# 27. Final Engineering Conclusion

The biggest challenge of Vacationist is NOT:
- technology
- scalability
- infrastructure

Instead, it is:
- UX
- group dynamics
- clarity
- simplicity
- clean data structures

If those areas are executed well, Vacationist has strong potential as a highly compelling collaborative travel and leisure planning platform.
