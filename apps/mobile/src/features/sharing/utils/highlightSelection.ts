import type { HighlightFormat, HighlightSelection } from '@vacationist/types';

// Slot model: 1 slot ≈ one line of flexible card height (~20px at the 360px
// reference width). Budgets are sized so a full selection never overflows the
// fixed card height, including the 2-line-title worst case (no separator line
// on the card — its former space is included in these budgets).
export const SLOT_BUDGETS: Record<HighlightFormat, number> = { square: 10, story: 20 };

export const SLOT_COSTS = {
  lineItem: 1,
  sectionLabel: 1,
  accommodation: 2,
  membersRow: 2,
  statsRow: 1,
  shoppingStat: 0,
} as const;

// Card sections that render as a label + dot-bullet lines. Flights, vehicles
// and rentals share the single 'transfers' section (one label).
export type CardSection = 'activities' | 'transfers' | 'recipes';

export type PickableKind = 'activity' | 'flight' | 'vehicle' | 'rental' | 'recipe';
export type SelectableKind = PickableKind | 'accommodation' | 'members' | 'stats' | 'shoppingStat';

export interface CandidateItem {
  id: string;
  label: string;
  isAutoPick: boolean;
}

export interface HighlightCandidates {
  tripTitle: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  memberCount: number;
  memberFirstNames: string[];
  shoppingItemCount: number;
  accommodations: CandidateItem[];
  activities: CandidateItem[];
  flights: CandidateItem[];
  vehicles: CandidateItem[];
  rentals: CandidateItem[];
  recipes: CandidateItem[];
}

export interface HighlightRenderData {
  tripTitle: string;
  startDate: string;
  endDate: string;
  accommodationName: string | null;
  sections: { key: CardSection; items: string[] }[];
  stats: { durationDays: number; memberCount: number; shoppingItemCount: number | null } | null;
  memberFirstNames: string[] | null;
}

const DEFAULT_ACTIVITY_CAP = 5;

export const highlightSelectionStorageKey = (tripId: string) => `highlight_selection_v1:${tripId}`;

export function emptySelection(): HighlightSelection {
  return {
    accommodationId: null,
    activityIds: [],
    flightIds: [],
    vehicleIds: [],
    rentalIds: [],
    recipeIds: [],
    showMembers: false,
    showStats: false,
    showShoppingStat: false,
  };
}

function transferCount(sel: HighlightSelection): number {
  return sel.flightIds.length + sel.vehicleIds.length + sel.rentalIds.length;
}

export function computeSlotUsage(sel: HighlightSelection): number {
  let used = 0;
  if (sel.accommodationId) used += SLOT_COSTS.accommodation;
  if (sel.activityIds.length > 0) used += SLOT_COSTS.sectionLabel + sel.activityIds.length * SLOT_COSTS.lineItem;
  const transfers = transferCount(sel);
  if (transfers > 0) used += SLOT_COSTS.sectionLabel + transfers * SLOT_COSTS.lineItem;
  if (sel.recipeIds.length > 0) used += SLOT_COSTS.sectionLabel + sel.recipeIds.length * SLOT_COSTS.lineItem;
  if (sel.showMembers) used += SLOT_COSTS.membersRow;
  if (sel.showStats) used += SLOT_COSTS.statsRow;
  if (sel.showShoppingStat) used += SLOT_COSTS.shoppingStat;
  return used;
}

// Cost of adding one element of `kind` to the current selection. The first
// line item of an empty card section also pays for the section label.
function marginalCost(sel: HighlightSelection, kind: SelectableKind): number {
  switch (kind) {
    case 'activity':
      return (sel.activityIds.length === 0 ? SLOT_COSTS.sectionLabel : 0) + SLOT_COSTS.lineItem;
    case 'flight':
    case 'vehicle':
    case 'rental':
      return (transferCount(sel) === 0 ? SLOT_COSTS.sectionLabel : 0) + SLOT_COSTS.lineItem;
    case 'recipe':
      return (sel.recipeIds.length === 0 ? SLOT_COSTS.sectionLabel : 0) + SLOT_COSTS.lineItem;
    case 'accommodation':
      return sel.accommodationId ? 0 : SLOT_COSTS.accommodation;
    case 'members':
      return sel.showMembers ? 0 : SLOT_COSTS.membersRow;
    case 'stats':
      return sel.showStats ? 0 : SLOT_COSTS.statsRow;
    case 'shoppingStat':
      return SLOT_COSTS.shoppingStat;
  }
}

export function canSelect(sel: HighlightSelection, kind: SelectableKind, format: HighlightFormat): boolean {
  return computeSlotUsage(sel) + marginalCost(sel, kind) <= SLOT_BUDGETS[format];
}

// Replicates the legacy auto-picked card: first booked/reserved accommodation,
// members row, stats row, then top reserved/planned activities until the
// budget (or the legacy cap of 5) is reached — 4 activities on square when
// accommodation, members and stats are all present.
export function deriveDefaultSelection(c: HighlightCandidates, format: HighlightFormat): HighlightSelection {
  const sel: HighlightSelection = {
    ...emptySelection(),
    accommodationId: c.accommodations.find((a) => a.isAutoPick)?.id ?? null,
    showMembers: c.memberFirstNames.length > 0,
    showStats: true,
  };
  const autoActivities = c.activities.filter((a) => a.isAutoPick).slice(0, DEFAULT_ACTIVITY_CAP);
  for (const a of autoActivities) {
    if (!canSelect(sel, 'activity', format)) break;
    sel.activityIds.push(a.id);
  }
  return sel;
}

// Drops IDs that no longer exist in the candidate pools (deleted items),
// preserving candidate order. Does NOT enforce the budget — compose with
// trimToBudget.
export function pruneSelection(sel: HighlightSelection, c: HighlightCandidates): HighlightSelection {
  const keep = (ids: string[], pool: CandidateItem[]) =>
    pool.filter((p) => ids.includes(p.id)).map((p) => p.id);
  return {
    ...sel,
    accommodationId:
      sel.accommodationId && c.accommodations.some((a) => a.id === sel.accommodationId)
        ? sel.accommodationId
        : null,
    activityIds: keep(sel.activityIds, c.activities),
    flightIds: keep(sel.flightIds, c.flights),
    vehicleIds: keep(sel.vehicleIds, c.vehicles),
    rentalIds: keep(sel.rentalIds, c.rentals),
    recipeIds: keep(sel.recipeIds, c.recipes),
  };
}

// Deterministic drop order when a selection exceeds the format budget
// (e.g. switching story → square): shopping stat → recipes tail → rentals tail
// → vehicles tail → flights tail → activities tail → members → accommodation
// → stats. Locked by unit tests — keep in sync with highlightSelection.test.ts.
export function trimToBudget(sel: HighlightSelection, format: HighlightFormat): HighlightSelection {
  const budget = SLOT_BUDGETS[format];
  if (computeSlotUsage(sel) <= budget) return sel;

  const next: HighlightSelection = {
    ...sel,
    activityIds: [...sel.activityIds],
    flightIds: [...sel.flightIds],
    vehicleIds: [...sel.vehicleIds],
    rentalIds: [...sel.rentalIds],
    recipeIds: [...sel.recipeIds],
    showShoppingStat: false,
  };

  while (computeSlotUsage(next) > budget) {
    if (next.recipeIds.length > 0) next.recipeIds.pop();
    else if (next.rentalIds.length > 0) next.rentalIds.pop();
    else if (next.vehicleIds.length > 0) next.vehicleIds.pop();
    else if (next.flightIds.length > 0) next.flightIds.pop();
    else if (next.activityIds.length > 0) next.activityIds.pop();
    else if (next.showMembers) next.showMembers = false;
    else if (next.accommodationId) next.accommodationId = null;
    else if (next.showStats) next.showStats = false;
    else break;
  }
  return next;
}

export function buildRenderData(c: HighlightCandidates, sel: HighlightSelection): HighlightRenderData {
  const labelsFor = (ids: string[], pool: CandidateItem[]) =>
    ids
      .map((id) => pool.find((p) => p.id === id)?.label)
      .filter((label): label is string => label !== undefined);

  const sections: HighlightRenderData['sections'] = [];
  const activityItems = labelsFor(sel.activityIds, c.activities);
  if (activityItems.length > 0) sections.push({ key: 'activities', items: activityItems });
  const transferItems = [
    ...labelsFor(sel.flightIds, c.flights),
    ...labelsFor(sel.vehicleIds, c.vehicles),
    ...labelsFor(sel.rentalIds, c.rentals),
  ];
  if (transferItems.length > 0) sections.push({ key: 'transfers', items: transferItems });
  const recipeItems = labelsFor(sel.recipeIds, c.recipes);
  if (recipeItems.length > 0) sections.push({ key: 'recipes', items: recipeItems });

  return {
    tripTitle: c.tripTitle,
    startDate: c.startDate,
    endDate: c.endDate,
    accommodationName: sel.accommodationId
      ? (c.accommodations.find((a) => a.id === sel.accommodationId)?.label ?? null)
      : null,
    sections,
    stats: sel.showStats
      ? {
          durationDays: c.durationDays,
          memberCount: c.memberCount,
          shoppingItemCount: sel.showShoppingStat && c.shoppingItemCount > 0 ? c.shoppingItemCount : null,
        }
      : null,
    memberFirstNames: sel.showMembers && c.memberFirstNames.length > 0 ? c.memberFirstNames : null,
  };
}
