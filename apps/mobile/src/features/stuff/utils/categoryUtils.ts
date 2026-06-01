// Maps seeded English category names to their stuff-namespace i18n keys.
// Custom (user-created) categories are not in this map and are shown as-is.

type CategoryI18nKey =
  | 'categories.clothes'
  | 'categories.cosmetics'
  | 'categories.documents'
  | 'categories.electronics'
  | 'categories.outdoor'
  | 'categories.medicine'
  | 'categories.shared'
  | 'categories.other';

export const SEEDED_CATEGORY_I18N: Partial<Record<string, CategoryI18nKey>> = {
  Clothes:     'categories.clothes',
  Cosmetics:   'categories.cosmetics',
  Documents:   'categories.documents',
  Electronics: 'categories.electronics',
  Outdoor:     'categories.outdoor',
  Medicine:    'categories.medicine',
  Shared:      'categories.shared',
  Other:       'categories.other',
};
