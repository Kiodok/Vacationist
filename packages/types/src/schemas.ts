import { z } from 'zod';
import { SUPPORTED_TIMEZONES } from './enums';

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
