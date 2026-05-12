import type {
  TripStatus,
  MemberRole,
  VoteType,
  ActivityStatus,
  AccommodationStatus,
  ExpenseRelatedType,
  ExpenseSplitStatus,
  ShoppingItemStatus,
  Currency,
  NotificationType,
  SupportedTimezone,
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
  paid_by: string;
  created_by: string;
  created_at: string;
  archived_at: string | null;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  user_id: string;
  amount_owed: number;
  status: ExpenseSplitStatus;
}

export interface ShoppingList {
  id: string;
  trip_id: string;
  title: string;
  created_by: string;
  created_at: string;
}

export interface ShoppingItem {
  id: string;
  shopping_list_id: string;
  title: string;
  quantity: number | null;
  unit: string | null;
  status: ShoppingItemStatus;
  source_recipe_id: string | null;
  created_by: string;
  deleted_at: string | null;
}

export interface Recipe {
  id: string;
  trip_id: string;
  title: string;
  description: string | null;
  servings: number;
  created_by: string;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  title: string;
  quantity: number | null;
  unit: string | null;
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
