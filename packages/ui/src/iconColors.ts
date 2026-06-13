import { Ionicons } from '@expo/vector-icons';
import { accentColors } from './theme';

// These brand colors are identical in both themes — safe to hardcode
const PRIMARY = '#6C63FF';
const SUCCESS = '#3ECF8E';
const WARNING = '#F5A623';
const NEUTRAL = '#A0A0A0'; // mid-tone, readable on both dark and light backgrounds

type IoniconsName = keyof typeof Ionicons.glyphMap;

export interface IconColorConfig {
  icon: IoniconsName;
  color: string;
}

export const CATEGORY_ICON_COLORS: Record<string, IconColorConfig> = {
  sightseeing: { icon: 'camera-outline',              color: accentColors.rose },
  food:        { icon: 'restaurant-outline',           color: accentColors.pink },
  nightlife:   { icon: 'moon-outline',                 color: PRIMARY },
  outdoors:    { icon: 'leaf-outline',                 color: accentColors.emerald },
  culture:     { icon: 'library-outline',              color: accentColors.indigo },
  shopping:    { icon: 'bag-outline',                  color: accentColors.orange },
  relaxation:  { icon: 'sunny-outline',                color: accentColors.amber },
  sport:       { icon: 'football-outline',             color: accentColors.sky },
  transport:   { icon: 'bus-outline',                  color: accentColors.teal },
  other:       { icon: 'ellipsis-horizontal-outline',  color: NEUTRAL },
};

export const FEATURE_ICON_COLORS: Record<string, IconColorConfig> = {
  activity:      { icon: 'compass-outline',      color: PRIMARY },
  accommodation: { icon: 'bed-outline',           color: accentColors.teal },
  flight:        { icon: 'airplane-outline',      color: accentColors.sky },
  vehicle:       { icon: 'car-outline',           color: accentColors.emerald },
  rental:        { icon: 'car-sport-outline',     color: accentColors.amber },
  expense:       { icon: 'wallet-outline',        color: WARNING },
  recipe:        { icon: 'restaurant-outline',    color: accentColors.pink },
  shopping:      { icon: 'cart-outline',          color: accentColors.orange },
};

export const NOTIFICATION_ICON_COLORS: Record<string, IconColorConfig> = {
  new_activity:             { icon: 'add-circle-outline',       color: PRIMARY },
  vote_update:              { icon: 'thumbs-up-outline',        color: accentColors.emerald },
  vote_finalized:           { icon: 'checkmark-circle-outline', color: SUCCESS },
  expense_change:           { icon: 'wallet-outline',           color: WARNING },
  new_member:               { icon: 'person-add-outline',       color: accentColors.sky },
  schedule_change:          { icon: 'calendar-outline',         color: accentColors.teal },
  reminder:                 { icon: 'megaphone-outline',        color: accentColors.amber },
  document_access_request:  { icon: 'document-text-outline',   color: accentColors.indigo },
  activity_note:            { icon: 'chatbubble-outline',        color: accentColors.teal },
  lost_found:               { icon: 'search-outline',           color: accentColors.rose },
  shared_packing:           { icon: 'bag-outline',              color: accentColors.orange },
  expense_settlement:       { icon: 'receipt-outline',          color: SUCCESS },
};

export const METADATA_ICON_COLORS: Record<string, IconColorConfig> = {
  calendar: { icon: 'calendar-outline',          color: SUCCESS },
  time:     { icon: 'time-outline',              color: accentColors.sky },
  location: { icon: 'location-outline',          color: PRIMARY },
  cost:     { icon: 'wallet-outline',            color: WARNING },
  link:     { icon: 'link-outline',              color: PRIMARY },
  person:   { icon: 'person-outline',            color: accentColors.teal },
  people:   { icon: 'people-outline',            color: PRIMARY },
  list:     { icon: 'list-outline',              color: accentColors.indigo },
  receipt:  { icon: 'receipt-outline',           color: accentColors.amber },
  barcode:  { icon: 'barcode-outline',           color: accentColors.teal },
  airplane: { icon: 'airplane-outline',          color: accentColors.sky },
  ticket:   { icon: 'ticket-outline',            color: WARNING },
  return:   { icon: 'return-up-back-outline',    color: accentColors.teal },
  chevron:  { icon: 'chevron-forward',           color: NEUTRAL },
};
