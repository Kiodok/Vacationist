import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enTrips from './locales/en/trips.json';
import enActivities from './locales/en/activities.json';
import enExpenses from './locales/en/expenses.json';
import enAccommodations from './locales/en/accommodations.json';
import enTransfer from './locales/en/transfer.json';
import enShopping from './locales/en/shopping.json';
import enRecipes from './locales/en/recipes.json';
import enCalendar from './locales/en/calendar.json';
import enPrework from './locales/en/prework.json';
import enNotifications from './locales/en/notifications.json';
import enProfile from './locales/en/profile.json';
import enNotes from './locales/en/notes.json';
import enValidation from './locales/en/validation.json';

import deCommon from './locales/de/common.json';
import deAuth from './locales/de/auth.json';
import deTrips from './locales/de/trips.json';
import deActivities from './locales/de/activities.json';
import deExpenses from './locales/de/expenses.json';
import deAccommodations from './locales/de/accommodations.json';
import deTransfer from './locales/de/transfer.json';
import deShopping from './locales/de/shopping.json';
import deRecipes from './locales/de/recipes.json';
import deCalendar from './locales/de/calendar.json';
import dePrework from './locales/de/prework.json';
import deNotifications from './locales/de/notifications.json';
import deProfile from './locales/de/profile.json';
import deNotes from './locales/de/notes.json';
import deValidation from './locales/de/validation.json';

const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    trips: enTrips,
    activities: enActivities,
    expenses: enExpenses,
    accommodations: enAccommodations,
    transfer: enTransfer,
    shopping: enShopping,
    recipes: enRecipes,
    calendar: enCalendar,
    prework: enPrework,
    notifications: enNotifications,
    profile: enProfile,
    notes: enNotes,
    validation: enValidation,
  },
  de: {
    common: deCommon,
    auth: deAuth,
    trips: deTrips,
    activities: deActivities,
    expenses: deExpenses,
    accommodations: deAccommodations,
    transfer: deTransfer,
    shopping: deShopping,
    recipes: deRecipes,
    calendar: deCalendar,
    prework: dePrework,
    notifications: deNotifications,
    profile: deProfile,
    notes: deNotes,
    validation: deValidation,
  },
} as const;

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: [
    'common', 'auth', 'trips', 'activities', 'expenses', 'accommodations',
    'transfer', 'shopping', 'recipes', 'calendar', 'prework', 'notifications',
    'profile', 'notes', 'validation',
  ],
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
  compatibilityJSON: 'v4',
});

export default i18n;
