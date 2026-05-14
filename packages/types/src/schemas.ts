import { z } from 'zod';
import { SUPPORTED_TIMEZONES, CURRENCY, TRIP_STATUS, ACTIVITY_STATUS, ACCOMMODATION_STATUS, EXPENSE_RELATED_TYPE, EXPENSE_SPLIT_METHOD, SHOPPING_ITEM_STATUS } from './enums';

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

// --- Invite schemas ---

const INVITE_EXPIRY = ['1h', '24h', '7d'] as const;

export const createInviteSchema = z.object({
  expires_in: z.enum(INVITE_EXPIRY),
  max_uses: z.number().int().positive().nullable().optional(),
});

export type InviteExpiry = (typeof INVITE_EXPIRY)[number];
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
