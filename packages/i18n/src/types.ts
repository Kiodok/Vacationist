import type enCommon from './locales/en/common.json';
import type enAuth from './locales/en/auth.json';
import type enTrips from './locales/en/trips.json';
import type enActivities from './locales/en/activities.json';
import type enExpenses from './locales/en/expenses.json';
import type enAccommodations from './locales/en/accommodations.json';
import type enTransfer from './locales/en/transfer.json';
import type enShopping from './locales/en/shopping.json';
import type enRecipes from './locales/en/recipes.json';
import type enCalendar from './locales/en/calendar.json';
import type enPrework from './locales/en/prework.json';
import type enNotifications from './locales/en/notifications.json';
import type enProfile from './locales/en/profile.json';
import type enNotes from './locales/en/notes.json';
import type enValidation from './locales/en/validation.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof enCommon;
      auth: typeof enAuth;
      trips: typeof enTrips;
      activities: typeof enActivities;
      expenses: typeof enExpenses;
      accommodations: typeof enAccommodations;
      transfer: typeof enTransfer;
      shopping: typeof enShopping;
      recipes: typeof enRecipes;
      calendar: typeof enCalendar;
      prework: typeof enPrework;
      notifications: typeof enNotifications;
      profile: typeof enProfile;
      notes: typeof enNotes;
      validation: typeof enValidation;
    };
  }
}
