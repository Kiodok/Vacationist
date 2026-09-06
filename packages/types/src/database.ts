import type {
  TripStatus,
  MemberRole,
  VoteType,
  ActivityStatus,
  AccommodationStatus,
  ExpenseRelatedType,
  ExpenseSplitMethod,
  ExpenseSplitStatus,
  ShoppingItemStatus,
  Currency,
  NotificationType,
  SupportedTimezone,
  TransferFlightStatus,
  TransferDirection,
  DocumentType,
  AccessRequestDuration,
  SharedPackingItemType,
  LostFoundCaseType,
} from './enums';

export interface User {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  locale: string | null;
  timezone: string;
  is_guest: boolean;
  preferred_currency: Currency | null;
  show_store_badges: boolean;
  created_at: string;
  updated_at: string;
}

export interface Trip {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  budget_per_person: number | null;
  base_currency: Currency;
  timezone: SupportedTimezone;
  status: TripStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TripMember {
  id: string;
  trip_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
}

export interface InviteToken {
  id: string;
  trip_id: string;
  token: string;
  created_by: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  max_uses: number | null;
  use_count: number;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  trip_id: string;
  title: string;
  description: string | null;
  category: string | null;
  cost_estimate: number | null;
  activity_date: string | null;
  start_time: string | null;
  end_time: string | null;
  external_url: string | null;
  maps_url: string | null;
  status: ActivityStatus;
  voting_open: boolean;
  auto_close: boolean;
  reservation_required: boolean;
  created_by: string;
  created_at: string;
  deleted_at: string | null;
}

export interface ActivityVote {
  id: string;
  trip_id: string;
  activity_id: string;
  user_id: string;
  vote: VoteType;
  created_at: string;
}

export interface ActivityNote {
  id: string;
  activity_id: string;
  trip_id: string;
  created_by: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Accommodation {
  id: string;
  trip_id: string;
  title: string;
  description: string | null;
  price_total: number | null;
  currency: Currency;
  is_business: boolean;
  external_url: string | null;
  maps_url: string | null;
  notes: string | null;
  status: AccommodationStatus;
  voting_open: boolean;
  auto_close: boolean;
  check_in_date: string | null;
  check_out_date: string | null;
  created_by: string;
  created_at: string;
  deleted_at: string | null;
}

export interface AccommodationNote {
  id: string;
  accommodation_id: string;
  trip_id: string;
  created_by: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface AccommodationVote {
  id: string;
  trip_id: string;
  accommodation_id: string;
  user_id: string;
  vote: VoteType;
  created_at: string;
}

export interface Tour {
  id: string;
  trip_id: string;
  title: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface TourActivity {
  id: string;
  tour_id: string;
  activity_id: string;
  sort_order: number;
}

export interface Expense {
  id: string;
  trip_id: string;
  related_type: ExpenseRelatedType;
  related_id: string | null;
  title: string;
  description: string | null;
  amount: number;
  currency: Currency;
  /** Multiplier from `currency` to the trip's base_currency, frozen at creation/edit time. 1 when currency === base_currency. */
  exchange_rate: number;
  /** `amount * exchange_rate`, rounded — what balance/settlement math sums, not `amount`. */
  converted_amount: number;
  split_method: ExpenseSplitMethod;
  paid_by: string;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  archived_at: string | null;
  is_business: boolean;
  payer?: { id: string; name: string; avatar_url: string | null } | null;
}

export interface ExpenseSplit {
  id: string;
  trip_id: string;
  expense_id: string;
  user_id: string;
  amount_owed: number;
  status: ExpenseSplitStatus;
  covered_by: string | null;
  original_amount: number | null;
  /** Split amount in the expense's own currency; only set when currency !== trip base_currency. */
  amount_owed_original_currency: number | null;
  split_user?: { id: string; name: string; avatar_url: string | null } | null;
}

export interface ExpenseWithSplits extends Expense {
  expense_splits: ExpenseSplit[];
}

export interface MemberBalance {
  user_id: string;
  total_paid: number;
  total_owed: number;
  net_balance: number;
}

export interface ExpenseCategoryTotal {
  related_type: ExpenseRelatedType;
  total: number;
}

/** One row from the `get_trip_cost_summary` RPC (v1.34.0 items 7/8) — deliberately "dumb":
 * mechanical status/soft-delete filtering and per-(source, currency) grouping only. `source` is
 * `string`, not a closed union — `computeTripCostSummary` (@vacationist/utils) is built to
 * safely ignore an unrecognized source rather than crash, so the client survives a future RPC
 * change that adds a new source before the client is updated to categorize it. */
export interface CostSummaryRow {
  source: string;
  currency: string;
  amount: number;
}

/** One row from the `get_my_trip_cost_shares` RPC (v1.34.0 item 2 — the global Analytics tab).
 * Unlike `get_trip_cost_summary`, `transfer_flight` AND `transfer_public_transport` rows are
 * one-per-entry (not pre-aggregated) so `is_mine` can gate each entry's contribution
 * individually — see the migration's doc comment for why. `is_mine` is `true` when the caller is
 * an assigned passenger on that flight/PT entry OR has uploaded a ticket for it (v1.34.1 tasks
 * 3/4); `null` for every even-split source (accommodation / rental / activity / expense).
 * v1.34.2: a flight/PT entry with zero participants (no assigned passenger and no ticket) is
 * omitted entirely — it contributes 0 to the group card too, and emitting it would wrongly
 * register transfer-entity presence for the category-precedence logic in `computeMyCostShares`.
 *
 * `related_type` (v1.34.2) is only set on `source === 'expense_owed_by_me'` rows — the caller's
 * `expense_splits.amount_owed` sum for that trip, now split out one row per `expenses.related_type`
 * ('accommodation' | 'activity' | 'transport' | 'shopping' | 'manual') so `computeMyCostShares`
 * can apply the same category-level precedence `computeTripCostSummary` uses (an entity-priced
 * category's price wins; its matching expense bucket only counts when nothing is priced there).
 * `null` for every non-expense source. */
export interface MyCostShareRow {
  trip_id: string;
  trip_title: string;
  start_date: string;
  member_count: number;
  source: string;
  currency: string;
  amount: number;
  is_mine: boolean | null;
  related_type: string | null;
}

/** Payload sent to the render-business-expense-pdf Edge Function — the same rows the client
 * renders into the Markdown summary, already formatted for display. */
export interface BusinessExpensePdfInput {
  tripTitle: string;
  currency: string;
  rows: {
    date: string;
    title: string;
    amount: string;
    paidBy: string;
    documents: { fileName: string; url: string }[];
  }[];
  total: string;
  count: number;
}

export interface ShoppingList {
  id: string;
  trip_id: string;
  title: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface ShoppingListWithCounts extends ShoppingList {
  item_count: number;
  bought_count: number;
}

export interface ShoppingItem {
  id: string;
  trip_id: string;
  shopping_list_id: string;
  title: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  position: number;
  status: ShoppingItemStatus;
  source_recipe_id: string | null;
  source_ingredient_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Recipe {
  id: string;
  trip_id: string;
  title: string;
  description: string | null;
  servings: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  title: string;
  quantity: number | null;
  unit: string | null;
  sort_order: number;
}

export interface RecipeWithIngredients extends Recipe {
  recipe_ingredients: RecipeIngredient[];
  ingredient_count: number;
}

export interface PreworkFilter {
  label: string;
  weight: number;
}

export interface PreworkTopic {
  id: string;
  trip_id: string;
  title: string;
  description: string | null;
  seeded_labels: string[];
  position: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PreworkPreferences {
  id: string;
  trip_id: string;
  topic_id: string;
  user_id: string;
  filters: PreworkFilter[];
  updated_at: string;
}

export interface TransferFlight {
  id: string;
  trip_id: string;
  title: string;
  description: string | null;
  direction: TransferDirection;
  airline: string | null;
  departure_airport: string | null;
  arrival_airport: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  return_departure_airport: string | null;
  return_arrival_airport: string | null;
  return_departure_time: string | null;
  return_arrival_time: string | null;
  price_per_person: number | null;
  currency: Currency;
  is_business: boolean;
  external_url: string | null;
  flight_number: string | null;
  /** Return-leg flight number — populated only for `direction === 'outbound-return'`. */
  return_flight_number: string | null;
  booking_reference: string | null;
  notes: string | null;
  status: TransferFlightStatus;
  voting_open: boolean;
  auto_close: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TransferFlightVote {
  id: string;
  trip_id: string;
  flight_id: string;
  user_id: string;
  vote: VoteType;
  created_at: string;
}

export interface TransferFlightPassenger {
  id: string;
  trip_id: string;
  flight_id: string;
  user_id: string;
  created_at: string;
}

export interface TransferVehicle {
  id: string;
  trip_id: string;
  title: string;
  direction: TransferDirection;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TransferVehiclePassenger {
  id: string;
  trip_id: string;
  vehicle_id: string;
  user_id: string;
  is_driver: boolean;
  created_at: string;
}

export interface TransferPublicTransportPassenger {
  id: string;
  trip_id: string;
  public_transport_id: string;
  user_id: string;
  created_at: string;
}

export interface TransferRental {
  id: string;
  trip_id: string;
  title: string;
  company: string | null;
  pickup_location: string | null;
  dropoff_location: string | null;
  pickup_date: string | null;
  dropoff_date: string | null;
  booking_reference: string | null;
  price_total: number | null;
  currency: Currency;
  is_business: boolean;
  external_url: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TransferPublicTransport {
  id: string;
  trip_id: string;
  title: string;
  company: string | null;
  departure_location: string | null;
  arrival_location: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  booking_reference: string | null;
  price_total: number | null;
  currency: Currency;
  is_business: boolean;
  external_url: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ExpenseDocument {
  id: string;
  trip_id: string;
  expense_id: string;
  uploaded_by: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  created_at: string;
}

export interface TransferDocument {
  id: string;
  trip_id: string;
  /** Exactly one of flight_id / public_transport_id is set. */
  flight_id: string | null;
  public_transport_id: string | null;
  /** The passenger this ticket belongs to — may differ from uploaded_by when the organizer uploads on a member's behalf. */
  user_id: string;
  uploaded_by: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  created_at: string;
  updated_at: string;
}

export interface UserPushToken {
  id: string;
  user_id: string;
  push_token: string;
  platform: 'ios' | 'android';
  created_at: string;
  updated_at: string;
}

/** A browser push subscription (v1.34.0 item 1 — Phase 12: Web Push). Separate from
 * UserPushToken (Expo/native) — a browser subscription has no Expo push token, just an endpoint
 * URL and the encryption keys the Web Push protocol needs. */
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

/** A WebAuthn credential backing Android Zero-Tap Sign-In (Phase 17 — Android Restore
 * Credentials API). Only the public half is stored server-side; the private key lives in
 * Google's end-to-end-encrypted credential store and travels to a new device on migration. */
export interface RestoreCredential {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  sign_count: number;
  aaguid: string | null;
  created_at: string;
  last_used_at: string | null;
}

export interface Notification {
  id: string;
  trip_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  related_type: string | null;
  related_id: string | null;
  is_read: boolean;
  push_sent_at: string | null;
  created_at: string;
  context_entity: string | null;
  context_trip: string | null;
  context_creator: string | null;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  trip_id: string;
  new_activity: boolean;
  vote_update: boolean;
  expense_change: boolean;
  new_member: boolean;
  schedule_change: boolean;
  reminder: boolean;
  lost_found: boolean;
  shared_packing: boolean;
  activity_reminder: boolean;
  new_chat_message: boolean;
}

export interface TravelDocument {
  id: string;
  document_type: DocumentType;
  full_legal_name: string;
  document_number: string;
  date_of_birth: string | null;
  nationality: string | null;
  issuing_country: string | null;
  expiry_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentAccessRequest {
  request_id: string;
  trip_id: string;
  trip_title: string;
  requested_by: string;
  requester_name: string;
  requester_avatar: string | null;
  duration_minutes: AccessRequestDuration;
  created_at: string;
}

/** One (member, document_type) a trip organizer currently has access to — metadata only, no
 * decrypted PII. Returned by get_member_document_access_list; the organizer taps through to
 * reveal_member_documents (which returns AccessibleMemberDocument and starts the timer). */
export interface MemberDocumentAccessEntry {
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  document_type: DocumentType;
  /** NULL until the organizer first opened this member's documents (the countdown start). */
  activated_at: string | null;
  /** NULL until activated, then activated_at + the request's duration. */
  expires_at: string | null;
  /** Outer 7-day window — a grant never opened auto-expires at this time. */
  grant_deadline: string;
}

export interface AccessibleMemberDocument {
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  document_type: DocumentType;
  full_legal_name: string;
  document_number: string;
  date_of_birth: string | null;
  nationality: string | null;
  issuing_country: string | null;
  expiry_date: string | null;
  notes: string | null;
  grant_expires_at: string;
}

export interface ActiveGrant {
  grant_id: string;
  request_id: string;
  trip_id: string;
  trip_title: string;
  requester_name: string;
  requester_avatar: string | null;
  /** NULL until the organizer first opens the documents — then the countdown runs to here. */
  expires_at: string | null;
  activated_at: string | null;
  grant_deadline: string;
}

export interface TripNote {
  id: string;
  trip_id: string;
  created_by: string;
  title: string;
  description: string | null;
  is_done: boolean;
  created_at: string;
  updated_at: string;
}

export interface TripMessage {
  id: string;
  trip_id: string;
  created_by: string;
  text: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type MessageSender = Pick<User, 'name' | 'avatar_url'>;

export interface TripMessageWithSender extends TripMessage {
  sender: MessageSender | null;
}

export interface TripMessagesPage {
  items: TripMessageWithSender[];
  nextCursor: string | null;
}

export interface PackingCategory {
  id: string;
  name: string;
  icon: string | null;
  sort_order: number;
  is_default: boolean;
}

export interface PackingItem {
  id: string;
  trip_id: string;
  user_id: string;
  category: string;
  title: string;
  is_packed: boolean;
  notes: string | null;
  sort_order: number;
  source_shared_item_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface SharedPackingItem {
  id: string;
  trip_id: string;
  title: string;
  item_type: SharedPackingItemType;
  notes: string | null;
  created_by: string;
  claimed_by: string | null;
  is_resolved: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface SettlementSnapshotEntry {
  from_user_id: string;
  from_user_name: string;
  to_user_id: string;
  to_user_name: string;
  amount: number;
}

export interface SettlementSnapshotMember {
  user_id: string;
  name: string;
}

export interface SettlementSnapshot {
  settlements: SettlementSnapshotEntry[];
  members: SettlementSnapshotMember[];
  settled_split_ids: string[];
}

export interface SettlementReceipt {
  id: string;
  trip_id: string;
  settled_by: string;
  currency: Currency;
  total_amount: number;
  splits_count: number;
  snapshot: SettlementSnapshot;
  created_at: string;
}

export interface CurrencyCatalogEntry {
  code: string;
  name: string;
  symbol: string | null;
  is_rate_available: boolean;
  is_active: boolean;
}

export interface ExchangeRate {
  currency: string;
  /** Value of 1 EUR in `currency`. */
  rate: number;
  as_of: string;
  /** Which feed priced this currency that day — 'ecb' (Frankfurter, primary) or 'exchangerate-api' (gap-filler, Phase 15b). */
  source?: string;
}

export interface LostFoundCase {
  id: string;
  trip_id: string;
  case_type: LostFoundCaseType;
  title: string;
  description: string | null;
  created_by: string;
  target_user: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

// "Has data" flags per trip tab — backs the tab bar's populated-tab border.
// From public.get_trip_tab_content(p_trip_id). Overview/Settings are deliberately absent —
// never "populated" or "empty" in this sense. Calendar has its own `calendar` flag (not a
// reuse of `activities`) — see the flag's own filter for why.
export interface TripTabContent {
  chat: boolean;
  prework: boolean;
  base: boolean;
  transfer: boolean;
  expenses: boolean;
  activities: boolean;
  calendar: boolean;
  stuff: boolean;
  shopping: boolean;
  notes: boolean;
}
