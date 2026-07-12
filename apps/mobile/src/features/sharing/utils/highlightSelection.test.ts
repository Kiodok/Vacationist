import { describe, it, expect } from 'vitest';
import { persistedHighlightSelectionSchema, type HighlightSelection } from '@vacationist/types';
import {
  SLOT_BUDGETS,
  emptySelection,
  computeSlotUsage,
  canSelect,
  deriveDefaultSelection,
  pruneSelection,
  trimToBudget,
  buildRenderData,
  type HighlightCandidates,
  type CandidateItem,
} from './highlightSelection';

function item(id: string, label = `Label ${id}`, isAutoPick = false): CandidateItem {
  return { id, label, isAutoPick };
}

function candidates(overrides: Partial<HighlightCandidates> = {}): HighlightCandidates {
  return {
    tripTitle: 'Test Trip',
    startDate: '2026-08-01',
    endDate: '2026-08-08',
    durationDays: 8,
    memberCount: 4,
    memberFirstNames: ['Anna', 'Ben', 'Cleo', 'Dan'],
    shoppingItemCount: 12,
    accommodations: [item('acc-1', 'Beach House', true), item('acc-2', 'City Hotel')],
    activities: [
      item('act-1', 'Hiking Trail', true),
      item('act-2', 'Boat Tour', true),
      item('act-3', 'BBQ Night', true),
      item('act-4', 'Museum', true),
      item('act-5', 'Kayaking', true),
      item('act-6', 'Old Town Walk', true),
      item('act-7', 'Beach Day'),
    ],
    flights: [item('fl-1', 'FRA → LIS'), item('fl-2', 'LIS → FRA')],
    vehicles: [item('veh-1', 'VW Bus')],
    rentals: [item('ren-1', 'Rental: Fiat 500')],
    recipes: [item('rec-1', 'Paella Night'), item('rec-2', 'Pancakes')],
    ...overrides,
  };
}

function selection(overrides: Partial<HighlightSelection> = {}): HighlightSelection {
  return { ...emptySelection(), ...overrides };
}

describe('computeSlotUsage', () => {
  it('returns 0 for an empty selection', () => {
    expect(computeSlotUsage(emptySelection())).toBe(0);
  });

  it('charges section label once per non-empty card section', () => {
    // 2 activities → 1 label + 2 items = 3
    expect(computeSlotUsage(selection({ activityIds: ['act-1', 'act-2'] }))).toBe(3);
  });

  it('shares one label across flights, vehicles and rentals (transfers section)', () => {
    const sel = selection({ flightIds: ['fl-1'], vehicleIds: ['veh-1'], rentalIds: ['ren-1'] });
    expect(computeSlotUsage(sel)).toBe(4); // 1 label + 3 items
  });

  it('charges fixed costs for accommodation, members, stats; shopping stat is free', () => {
    expect(computeSlotUsage(selection({ accommodationId: 'acc-1' }))).toBe(2);
    expect(computeSlotUsage(selection({ showMembers: true }))).toBe(2);
    expect(computeSlotUsage(selection({ showStats: true }))).toBe(1);
    expect(computeSlotUsage(selection({ showStats: true, showShoppingStat: true }))).toBe(1);
  });

  it('sums a full mixed selection', () => {
    const sel = selection({
      accommodationId: 'acc-1', // 2
      activityIds: ['act-1', 'act-2', 'act-3'], // 1 + 3
      flightIds: ['fl-1'], // 1 + 1
      recipeIds: ['rec-1'], // 1 + 1
      showMembers: true, // 2
      showStats: true, // 1
    });
    expect(computeSlotUsage(sel)).toBe(13);
  });
});

describe('canSelect', () => {
  it('costs 2 for the first item of an empty section and 1 for subsequent items', () => {
    // Square budget 10: fill up to 8 used, then a NEW section (cost 2) fits exactly
    const sel = selection({ accommodationId: 'acc-1', activityIds: ['act-1', 'act-2', 'act-3', 'act-4', 'act-5'] }); // 2 + 6 = 8
    expect(canSelect(sel, 'recipe', 'square')).toBe(true); // 8 + 2 = 10
    expect(canSelect(sel, 'activity', 'square')).toBe(true); // 8 + 1 = 9

    const atNine = selection({ accommodationId: 'acc-1', activityIds: ['act-1', 'act-2', 'act-3', 'act-4', 'act-5', 'act-6'] }); // 9
    expect(canSelect(atNine, 'recipe', 'square')).toBe(false); // 9 + 2 = 11 > 10
    expect(canSelect(atNine, 'activity', 'square')).toBe(true); // 9 + 1 = 10
  });

  it('second transfer item costs 1 when another transfer kind is already selected', () => {
    const sel = selection({ vehicleIds: ['veh-1'], activityIds: ['act-1', 'act-2', 'act-3', 'act-4'] }); // 2 + 5 = 7
    expect(canSelect(sel, 'flight', 'square')).toBe(true); // shared transfers label → 7 + 1 = 8
  });

  it('blocks selection at exactly the budget', () => {
    const full = selection({
      accommodationId: 'acc-1', // 2
      activityIds: ['act-1', 'act-2', 'act-3', 'act-4'], // 5
      showMembers: true, // 2
      showStats: true, // 1  → 10 = square budget
    });
    expect(computeSlotUsage(full)).toBe(SLOT_BUDGETS.square);
    expect(canSelect(full, 'activity', 'square')).toBe(false);
    expect(canSelect(full, 'flight', 'square')).toBe(false);
    // Zero-cost changes remain allowed
    expect(canSelect(full, 'shoppingStat', 'square')).toBe(true);
    expect(canSelect(full, 'accommodation', 'square')).toBe(true); // replacement
  });
});

describe('deriveDefaultSelection', () => {
  it('replicates the legacy auto-picks on square: accommodation + members + stats + 4 activities', () => {
    const sel = deriveDefaultSelection(candidates(), 'square');
    expect(sel.accommodationId).toBe('acc-1');
    expect(sel.showMembers).toBe(true);
    expect(sel.showStats).toBe(true);
    expect(sel.showShoppingStat).toBe(false);
    expect(sel.activityIds).toEqual(['act-1', 'act-2', 'act-3', 'act-4']);
    expect(sel.flightIds).toEqual([]);
    expect(sel.recipeIds).toEqual([]);
    expect(computeSlotUsage(sel)).toBeLessThanOrEqual(SLOT_BUDGETS.square);
  });

  it('caps default activities at 5 on story despite the larger budget', () => {
    const sel = deriveDefaultSelection(candidates(), 'story');
    expect(sel.activityIds).toEqual(['act-1', 'act-2', 'act-3', 'act-4', 'act-5']);
    expect(computeSlotUsage(sel)).toBeLessThanOrEqual(SLOT_BUDGETS.story);
  });

  it('gives extra activity slots when the trip has no accommodation', () => {
    const sel = deriveDefaultSelection(candidates({ accommodations: [] }), 'square');
    expect(sel.accommodationId).toBeNull();
    expect(sel.activityIds).toEqual(['act-1', 'act-2', 'act-3', 'act-4', 'act-5']);
    expect(computeSlotUsage(sel)).toBeLessThanOrEqual(SLOT_BUDGETS.square);
  });

  it('only picks auto-pick candidates', () => {
    const sel = deriveDefaultSelection(candidates({ accommodations: [item('acc-2', 'City Hotel')] }), 'story');
    expect(sel.accommodationId).toBeNull();
    expect(sel.activityIds).not.toContain('act-7');
  });
});

describe('pruneSelection', () => {
  it('removes stale IDs and preserves candidate order', () => {
    const sel = selection({
      accommodationId: 'acc-gone',
      activityIds: ['act-2', 'act-gone', 'act-1'],
      flightIds: ['fl-gone'],
      recipeIds: ['rec-2'],
    });
    const pruned = pruneSelection(sel, candidates());
    expect(pruned.accommodationId).toBeNull();
    expect(pruned.activityIds).toEqual(['act-1', 'act-2']); // candidate order
    expect(pruned.flightIds).toEqual([]);
    expect(pruned.recipeIds).toEqual(['rec-2']);
  });

  it('returns an intact selection unchanged', () => {
    const sel = selection({ accommodationId: 'acc-1', activityIds: ['act-1', 'act-2'], showMembers: true });
    expect(pruneSelection(sel, candidates())).toEqual(sel);
  });
});

describe('trimToBudget', () => {
  it('is a no-op when within budget (keeps shopping stat)', () => {
    const sel = selection({ activityIds: ['act-1'], showStats: true, showShoppingStat: true });
    expect(trimToBudget(sel, 'square')).toEqual(sel);
  });

  it('drops in the documented order: shoppingStat → recipes → rentals → vehicles → flights → activities → members → accommodation → stats', () => {
    // Story-sized selection: 2 + (1+3) + (1+3) + (1+2) + 2 + 1 = 16 slots
    const sel = selection({
      accommodationId: 'acc-1',
      activityIds: ['act-1', 'act-2', 'act-3'],
      flightIds: ['fl-1', 'fl-2'],
      vehicleIds: ['veh-1'],
      recipeIds: ['rec-1', 'rec-2'],
      showMembers: true,
      showStats: true,
      showShoppingStat: true,
    });
    const trimmed = trimToBudget(sel, 'square'); // budget 10
    expect(trimmed.showShoppingStat).toBe(false);
    expect(trimmed.recipeIds).toEqual([]); // dropped first (16 → 13, label freed)
    expect(trimmed.vehicleIds).toEqual([]); // 13 → 12
    expect(trimmed.flightIds).toEqual([]); // 12 → 11 → 9 (last pop frees the transfers label)
    expect(trimmed.activityIds).toEqual(['act-1', 'act-2', 'act-3']); // untouched
    expect(trimmed.showMembers).toBe(true);
    expect(trimmed.accommodationId).toBe('acc-1');
    expect(trimmed.showStats).toBe(true);
    expect(computeSlotUsage(trimmed)).toBeLessThanOrEqual(SLOT_BUDGETS.square);
  });

  it('trims the activity tail before touching members, accommodation or stats', () => {
    const sel = selection({
      activityIds: ['act-1', 'act-2', 'act-3', 'act-4', 'act-5', 'act-6'], // 7
      accommodationId: 'acc-1', // 2
      showMembers: true, // 2
      showStats: true, // 1 → 12 total
    });
    const trimmed = trimToBudget(sel, 'square'); // budget 10
    expect(trimmed.activityIds).toEqual(['act-1', 'act-2', 'act-3', 'act-4']);
    expect(trimmed.showMembers).toBe(true);
    expect(trimmed.accommodationId).toBe('acc-1');
    expect(trimmed.showStats).toBe(true);
  });

  it('is idempotent', () => {
    const sel = selection({
      accommodationId: 'acc-1',
      activityIds: ['act-1', 'act-2', 'act-3', 'act-4', 'act-5', 'act-6'],
      recipeIds: ['rec-1', 'rec-2'],
      showMembers: true,
      showStats: true,
    });
    const once = trimToBudget(sel, 'square');
    expect(trimToBudget(once, 'square')).toEqual(once);
  });
});

describe('buildRenderData', () => {
  it('maps IDs to labels and hides empty sections', () => {
    const sel = selection({
      accommodationId: 'acc-1',
      activityIds: ['act-1', 'act-2'],
      flightIds: ['fl-1'],
      vehicleIds: ['veh-1'],
      showMembers: true,
      showStats: true,
      showShoppingStat: true,
    });
    const data = buildRenderData(candidates(), sel);
    expect(data.accommodationName).toBe('Beach House');
    expect(data.sections).toEqual([
      { key: 'activities', items: ['Hiking Trail', 'Boat Tour'] },
      { key: 'transfers', items: ['FRA → LIS', 'VW Bus'] },
    ]);
    expect(data.stats).toEqual({ durationDays: 8, memberCount: 4, shoppingItemCount: 12 });
    expect(data.memberFirstNames).toEqual(['Anna', 'Ben', 'Cleo', 'Dan']);
  });

  it('produces a minimal card for an empty selection', () => {
    const data = buildRenderData(candidates(), emptySelection());
    expect(data.tripTitle).toBe('Test Trip');
    expect(data.accommodationName).toBeNull();
    expect(data.sections).toEqual([]);
    expect(data.stats).toBeNull();
    expect(data.memberFirstNames).toBeNull();
  });

  it('hides the shopping stat when shopping count is 0 or stats are off', () => {
    const sel = selection({ showStats: true, showShoppingStat: true });
    expect(buildRenderData(candidates({ shoppingItemCount: 0 }), sel).stats?.shoppingItemCount).toBeNull();
    const statsOff = selection({ showShoppingStat: true });
    expect(buildRenderData(candidates(), statsOff).stats).toBeNull();
  });
});

describe('persistedHighlightSelectionSchema', () => {
  it('round-trips a valid payload', () => {
    const payload = { v: 1, format: 'square', selection: selection({ activityIds: ['act-1'] }) };
    const parsed = persistedHighlightSelectionSchema.safeParse(JSON.parse(JSON.stringify(payload)));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual(payload);
  });

  it('rejects unknown versions, missing fields and junk', () => {
    expect(persistedHighlightSelectionSchema.safeParse({ v: 2, format: 'square', selection: emptySelection() }).success).toBe(false);
    expect(persistedHighlightSelectionSchema.safeParse({ v: 1, format: 'portrait', selection: emptySelection() }).success).toBe(false);
    expect(persistedHighlightSelectionSchema.safeParse({ v: 1, format: 'square', selection: { activityIds: ['a'] } }).success).toBe(false);
    expect(persistedHighlightSelectionSchema.safeParse('not json at all').success).toBe(false);
    expect(persistedHighlightSelectionSchema.safeParse(null).success).toBe(false);
  });
});
