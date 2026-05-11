import { z } from 'zod';
import { SUPPORTED_TIMEZONES, CURRENCY, TRIP_STATUS } from './enums';

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

const INVITE_EXPIRY = ['1h', '24h', '7d'] as const;

export const createInviteSchema = z.object({
  expires_in: z.enum(INVITE_EXPIRY),
  max_uses: z.number().int().positive().nullable().optional(),
});

export type InviteExpiry = (typeof INVITE_EXPIRY)[number];
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
