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
} from './enums';

export interface User {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  locale: string;
  timezone: string;
  is_guest: boolean;
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

export interface Accommodation {
  id: string;
  trip_id: string;
  title: string;
  description: string | null;
  price_total: number | null;
  external_url: string | null;
  notes: string | null;
  status: AccommodationStatus;
  voting_open: boolean;
  created_by: string;
  created_at: string;
  deleted_at: string | null;
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
  amount: number;
  currency: Currency;
  split_method: ExpenseSplitMethod;
  paid_by: string;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  archived_at: string | null;
}

export interface ExpenseSplit {
  id: string;
  trip_id: string;
  expense_id: string;
  user_id: string;
  amount_owed: number;
  status: ExpenseSplitStatus;
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

export interface PreworkPreferences {
  id: string;
  trip_id: string;
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
  external_url: string | null;
  flight_number: string | null;
  booking_reference: string | null;
  notes: string | null;
  status: TransferFlightStatus;
  voting_open: boolean;
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
  external_url: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
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
  created_at: string;
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
  expires_at: string;
}
