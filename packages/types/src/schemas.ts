import { z } from 'zod';
import { SUPPORTED_TIMEZONES, CURRENCY, TRIP_STATUS, ACTIVITY_STATUS, ACCOMMODATION_STATUS, EXPENSE_RELATED_TYPE, EXPENSE_SPLIT_METHOD, SHOPPING_ITEM_STATUS, TRANSFER_FLIGHT_STATUS, TRANSFER_DIRECTION, DOCUMENT_TYPE } from './enums';

export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email().nullable(),
  avatar_url: z.string().url().nullable(),
  locale: z.string(),
  timezone: z.enum(SUPPORTED_TIMEZONES),
  is_guest: z.boolean(),
  created_at: z.string(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatar_url: z.string().url().max(2048).nullable().optional(),
  locale: z.string().optional(),
  timezone: z.enum(SUPPORTED_TIMEZONES).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// --- Trip schemas ---

export const createTripSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  budget_per_person: z.number().positive().nullable().optional(),
  base_currency: z.enum(CURRENCY),
  timezone: z.enum(SUPPORTED_TIMEZONES),
}).refine(
  (data) => data.end_date >= data.start_date,
  { message: 'End date must be on or after start date', path: ['end_date'] }
);

export const updateTripSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).nullable().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  budget_per_person: z.number().positive().nullable().optional(),
  base_currency: z.enum(CURRENCY).optional(),
  timezone: z.enum(SUPPORTED_TIMEZONES).optional(),
  status: z.enum(TRIP_STATUS).optional(),
}).refine(
  (data) => {
    if (data.start_date && data.end_date) {
      return data.end_date >= data.start_date;
    }
    return true;
  },
  { message: 'End date must be on or after start date', path: ['end_date'] }
);

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;

// --- Activity schemas ---

export const ACTIVITY_CATEGORIES = [
  'sightseeing',
  'food',
  'nightlife',
  'outdoors',
  'culture',
  'shopping',
  'relaxation',
  'sport',
  'transport',
  'other',
] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

const httpsUrlSchema = z
  .string()
  .max(2048)
  .refine((v) => v.startsWith('https://'), { message: 'URL must start with https://' });

export const createActivitySchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
  cost_estimate: z.number().nonnegative().nullable().optional(),
  activity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  external_url: httpsUrlSchema.nullable().optional(),
  maps_url: httpsUrlSchema.nullable().optional(),
});

export const updateActivitySchema = createActivitySchema.partial().extend({
  status: z.enum(ACTIVITY_STATUS).optional(),
});

export function createActivitySchemaForTrip(tripStartDate: string, tripEndDate: string) {
  return createActivitySchema.refine(
    (data) => {
      if (!data.activity_date) return true;
      return data.activity_date >= tripStartDate && data.activity_date <= tripEndDate;
    },
    {
      message: `Date must be within the trip dates (${tripStartDate} – ${tripEndDate})`,
      path: ['activity_date'],
    },
  );
}

export function updateActivitySchemaForTrip(tripStartDate: string, tripEndDate: string) {
  return updateActivitySchema.refine(
    (data) => {
      if (!data.activity_date) return true;
      return data.activity_date >= tripStartDate && data.activity_date <= tripEndDate;
    },
    {
      message: `Date must be within the trip dates (${tripStartDate} – ${tripEndDate})`,
      path: ['activity_date'],
    },
  );
}

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;

// --- Accommodation schemas ---

export const createAccommodationSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  price_total: z.number().nonnegative().nullable().optional(),
  external_url: httpsUrlSchema.nullable().optional(),
  notes: z.string().max(500).optional(),
});

export const updateAccommodationSchema = createAccommodationSchema.partial().extend({
  status: z.enum(ACCOMMODATION_STATUS).optional(),
});

export type CreateAccommodationInput = z.infer<typeof createAccommodationSchema>;
export type UpdateAccommodationInput = z.infer<typeof updateAccommodationSchema>;

// --- Expense schemas ---

export const splitEntrySchema = z.object({
  user_id: z.string().uuid(),
  amount: z.number().nonnegative().optional(),
  shares: z.number().int().positive().optional(),
});

export type SplitEntry = z.infer<typeof splitEntrySchema>;

export const createExpenseSchema = z.object({
  title: z.string().min(1).max(100),
  amount: z.number().positive(),
  currency: z.enum(CURRENCY),
  paid_by: z.string().uuid(),
  related_type: z.enum(EXPENSE_RELATED_TYPE),
  related_id: z.string().uuid().nullable().optional(),
  split_method: z.enum(EXPENSE_SPLIT_METHOD),
  splits: z.array(splitEntrySchema).min(1),
});

export const updateExpenseWithSplitsSchema = z.object({
  title: z.string().min(1).max(100),
  amount: z.number().positive(),
  paid_by: z.string().uuid(),
  split_method: z.enum(EXPENSE_SPLIT_METHOD),
  splits: z.array(splitEntrySchema).min(1),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseWithSplitsInput = z.infer<typeof updateExpenseWithSplitsSchema>;

// --- Shopping schemas ---

export const createShoppingListSchema = z.object({
  title: z.string().min(1).max(100),
});

export const updateShoppingListSchema = z.object({
  title: z.string().min(1).max(100),
});

export type CreateShoppingListInput = z.infer<typeof createShoppingListSchema>;
export type UpdateShoppingListInput = z.infer<typeof updateShoppingListSchema>;

export const createShoppingItemSchema = z.object({
  title: z.string().min(1).max(100),
});

export const updateShoppingItemSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  quantity: z.number().nonnegative().nullable().optional(),
  unit: z.string().max(50).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  status: z.enum(SHOPPING_ITEM_STATUS).optional(),
  position: z.number().int().nonnegative().optional(),
});

export type CreateShoppingItemInput = z.infer<typeof createShoppingItemSchema>;
export type UpdateShoppingItemInput = z.infer<typeof updateShoppingItemSchema>;

// --- Recipe schemas ---

export const createRecipeSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(1000).nullable().optional(),
  servings: z.number().int().positive(),
});

export const updateRecipeSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).nullable().optional(),
  servings: z.number().int().positive().optional(),
});

export const createRecipeIngredientSchema = z.object({
  title: z.string().min(1).max(100),
  quantity: z.number().nonnegative().nullable().optional(),
  unit: z.string().max(50).nullable().optional(),
});

export const updateRecipeIngredientSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  quantity: z.number().nonnegative().nullable().optional(),
  unit: z.string().max(50).nullable().optional(),
  sort_order: z.number().int().nonnegative().optional(),
});

export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;
export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>;
export type CreateRecipeIngredientInput = z.infer<typeof createRecipeIngredientSchema>;
export type UpdateRecipeIngredientInput = z.infer<typeof updateRecipeIngredientSchema>;

// --- Prework schemas ---

export const preworkFilterSchema = z.object({
  label: z.string().min(1).max(100),
  weight: z.number().int().min(1).max(100),
});

export const upsertPreworkPreferencesSchema = z.object({
  filters: z.array(preworkFilterSchema).refine(
    (filters) => {
      if (filters.length === 0) return true;
      const sum = filters.reduce((acc, f) => acc + f.weight, 0);
      return sum <= 100;
    },
    { message: 'Total credits must not exceed 100' }
  ).refine(
    (filters) => filters.every((f) => f.weight >= 1),
    { message: 'Every filter must have at least 1 credit' }
  ),
});

export type PreworkFilterInput = z.infer<typeof preworkFilterSchema>;
export type UpsertPreworkPreferencesInput = z.infer<typeof upsertPreworkPreferencesSchema>;

// --- Transfer schemas ---

const flightBaseSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  direction: z.enum(TRANSFER_DIRECTION),
  airline: z.string().max(100).optional(),
  departure_airport: z.string().max(100).optional(),
  arrival_airport: z.string().max(100).optional(),
  departure_time: z.string().nullable().optional(),
  arrival_time: z.string().nullable().optional(),
  return_departure_airport: z.string().max(100).optional(),
  return_arrival_airport: z.string().max(100).optional(),
  return_departure_time: z.string().nullable().optional(),
  return_arrival_time: z.string().nullable().optional(),
  price_per_person: z.number().nonnegative().nullable().optional(),
  external_url: httpsUrlSchema.nullable().optional(),
  notes: z.string().max(500).optional(),
});

export const createTransferFlightSchema = flightBaseSchema.superRefine((data, ctx) => {
  if (data.departure_time && data.arrival_time && data.arrival_time < data.departure_time) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Arrival cannot be before departure', path: ['arrival_time'] });
  }
  if (data.direction === 'outbound-return') {
    if (data.return_departure_time && data.arrival_time && data.return_departure_time < data.arrival_time) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Return departure cannot be before outbound arrival', path: ['return_departure_time'] });
    }
    if (data.return_departure_time && data.return_arrival_time && data.return_arrival_time < data.return_departure_time) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Return arrival cannot be before return departure', path: ['return_arrival_time'] });
    }
  }
});

export const updateTransferFlightSchema = flightBaseSchema.partial().extend({
  status: z.enum(TRANSFER_FLIGHT_STATUS).optional(),
}).superRefine((data, ctx) => {
  if (data.departure_time && data.arrival_time && data.arrival_time < data.departure_time) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Arrival cannot be before departure', path: ['arrival_time'] });
  }
  if (data.direction === 'outbound-return') {
    if (data.return_departure_time && data.arrival_time && data.return_departure_time < data.arrival_time) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Return departure cannot be before outbound arrival', path: ['return_departure_time'] });
    }
    if (data.return_departure_time && data.return_arrival_time && data.return_arrival_time < data.return_departure_time) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Return arrival cannot be before return departure', path: ['return_arrival_time'] });
    }
  }
});

export const bookTransferFlightSchema = z.object({
  flight_number: z.string().max(20).optional(),
  booking_reference: z.string().max(50).optional(),
});

export type CreateTransferFlightInput = z.infer<typeof createTransferFlightSchema>;
export type UpdateTransferFlightInput = z.infer<typeof updateTransferFlightSchema>;
export type BookTransferFlightInput = z.infer<typeof bookTransferFlightSchema>;

export const createTransferVehicleSchema = z.object({
  title: z.string().min(1).max(100),
  direction: z.enum(TRANSFER_DIRECTION),
  notes: z.string().max(500).optional(),
});

export const updateTransferVehicleSchema = createTransferVehicleSchema.partial();

export type CreateTransferVehicleInput = z.infer<typeof createTransferVehicleSchema>;
export type UpdateTransferVehicleInput = z.infer<typeof updateTransferVehicleSchema>;

export const createTransferRentalSchema = z.object({
  title: z.string().min(1).max(100),
  company: z.string().max(100).optional(),
  pickup_location: z.string().max(200).optional(),
  dropoff_location: z.string().max(200).optional(),
  pickup_date: z.string().nullable().optional(),
  dropoff_date: z.string().nullable().optional(),
  booking_reference: z.string().max(50).optional(),
  price_total: z.number().nonnegative().nullable().optional(),
  external_url: httpsUrlSchema.nullable().optional(),
  notes: z.string().max(500).optional(),
});

export const updateTransferRentalSchema = createTransferRentalSchema.partial();

export type CreateTransferRentalInput = z.infer<typeof createTransferRentalSchema>;
export type UpdateTransferRentalInput = z.infer<typeof updateTransferRentalSchema>;

// --- Invite schemas ---

const INVITE_EXPIRY = ['1h', '24h', '7d'] as const;

export const createInviteSchema = z.object({
  expires_in: z.enum(INVITE_EXPIRY),
  max_uses: z.number().int().positive().nullable().optional(),
});

export type InviteExpiry = (typeof INVITE_EXPIRY)[number];
export type CreateInviteInput = z.infer<typeof createInviteSchema>;

// --- Travel document schemas ---

export const upsertTravelDocumentSchema = z.object({
  document_type: z.enum(DOCUMENT_TYPE),
  full_legal_name: z.string().min(1, 'Required').max(200),
  document_number: z.string().min(1, 'Required').max(50),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .nullable()
    .optional(),
  nationality: z
    .string()
    .length(2, 'Must be a 2-letter ISO country code')
    .toUpperCase()
    .nullable()
    .optional(),
  issuing_country: z
    .string()
    .length(2, 'Must be a 2-letter ISO country code')
    .toUpperCase()
    .nullable()
    .optional(),
  expiry_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .nullable()
    .optional(),
  notes: z.string().max(500).nullable().optional(),
});

export type UpsertTravelDocumentInput = z.infer<typeof upsertTravelDocumentSchema>;

export const createDocumentAccessRequestSchema = z.object({
  trip_id: z.string().uuid(),
  duration_minutes: z
    .number()
    .refine((v): v is 15 | 30 | 60 => [15, 30, 60].includes(v), {
      message: 'Duration must be 15, 30, or 60 minutes',
    }),
});

export type CreateDocumentAccessRequestInput = z.infer<typeof createDocumentAccessRequestSchema>;

// --- Notification preference schemas ---

export const updateNotificationPreferencesSchema = z.object({
  new_activity:    z.boolean().optional(),
  vote_update:     z.boolean().optional(),
  expense_change:  z.boolean().optional(),
  new_member:      z.boolean().optional(),
  schedule_change: z.boolean().optional(),
  reminder:        z.boolean().optional(),
});

export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesSchema>;

// --- Trip note schemas ---

export const createTripNoteSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  description: z.string().max(1000).nullable().optional(),
});

export const updateTripNoteSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100).optional(),
  description: z.string().max(1000).nullable().optional(),
});

export type CreateTripNoteInput = z.infer<typeof createTripNoteSchema>;
export type UpdateTripNoteInput = z.infer<typeof updateTripNoteSchema>;
