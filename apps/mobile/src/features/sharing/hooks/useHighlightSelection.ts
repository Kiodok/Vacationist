import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  persistedHighlightSelectionSchema,
  type HighlightFormat,
  type HighlightSelection,
  type PersistedHighlightSelection,
} from '@vacationist/types';
import { storage } from '../../../utils/mmkvStorage';
import {
  SLOT_BUDGETS,
  canSelect,
  computeSlotUsage,
  deriveDefaultSelection,
  highlightSelectionStorageKey,
  pruneSelection,
  trimToBudget,
  type HighlightCandidates,
  type PickableKind,
  type SelectableKind,
} from '../utils/highlightSelection';

const PICKABLE_KEY: Record<PickableKind, 'activityIds' | 'flightIds' | 'vehicleIds' | 'rentalIds' | 'recipeIds'> = {
  activity: 'activityIds',
  flight: 'flightIds',
  vehicle: 'vehicleIds',
  rental: 'rentalIds',
  recipe: 'recipeIds',
};

function readPersisted(tripId: string): PersistedHighlightSelection | null {
  try {
    const key = highlightSelectionStorageKey(tripId);
    const raw = Platform.OS === 'web' ? localStorage.getItem(key) : (storage.getString(key) ?? null);
    if (!raw) return null;
    const parsed = persistedHighlightSelectionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function writePersisted(tripId: string, format: HighlightFormat, selection: HighlightSelection): void {
  try {
    const key = highlightSelectionStorageKey(tripId);
    const payload: PersistedHighlightSelection = { v: 1, format, selection };
    const raw = JSON.stringify(payload);
    if (Platform.OS === 'web') localStorage.setItem(key, raw);
    else storage.set(key, raw);
  } catch {
    // Persistence is best-effort; the in-memory selection stays valid.
  }
}

export function useHighlightSelection(
  tripId: string,
  candidates: HighlightCandidates | null,
  isLoaded: boolean,
) {
  const [format, setFormatState] = useState<HighlightFormat>('square');
  const [selection, setSelection] = useState<HighlightSelection | null>(null);
  const [wasTrimmed, setWasTrimmed] = useState(false);
  const hydratedRef = useRef(false);

  // Hydrate once, only after ALL queries have settled — otherwise a persisted
  // selection would be pruned against pools that are merely still loading.
  useEffect(() => {
    if (hydratedRef.current || !isLoaded || !candidates) return;
    hydratedRef.current = true;
    const persisted = readPersisted(tripId);
    if (persisted) {
      setFormatState(persisted.format);
      // Pruning is NOT written back here — a transiently missing item must not
      // permanently erase the user's saved picks. The next user mutation persists.
      setSelection(trimToBudget(pruneSelection(persisted.selection, candidates), persisted.format));
    } else {
      setSelection(deriveDefaultSelection(candidates, 'square'));
    }
  }, [isLoaded, candidates, tripId]);

  const commit = useCallback(
    (next: HighlightSelection, nextFormat: HighlightFormat) => {
      setSelection(next);
      writePersisted(tripId, nextFormat, next);
    },
    [tripId],
  );

  const setFormat = useCallback(
    (next: HighlightFormat) => {
      setFormatState(next);
      if (!selection) return;
      const trimmed = trimToBudget(selection, next);
      setWasTrimmed(trimmed !== selection);
      commit(trimmed, next);
    },
    [selection, commit],
  );

  const toggleItem = useCallback(
    (kind: PickableKind, id: string) => {
      if (!selection) return;
      const key = PICKABLE_KEY[kind];
      const ids = selection[key];
      let next: HighlightSelection;
      if (ids.includes(id)) {
        next = { ...selection, [key]: ids.filter((x) => x !== id) };
      } else {
        if (!canSelect(selection, kind, format)) return;
        next = { ...selection, [key]: [...ids, id] };
      }
      setWasTrimmed(false);
      commit(next, format);
    },
    [selection, format, commit],
  );

  const setAccommodation = useCallback(
    (id: string | null) => {
      if (!selection) return;
      if (id !== null && selection.accommodationId === null && !canSelect(selection, 'accommodation', format)) return;
      setWasTrimmed(false);
      commit({ ...selection, accommodationId: id }, format);
    },
    [selection, format, commit],
  );

  const toggleMembers = useCallback(() => {
    if (!selection) return;
    if (!selection.showMembers && !canSelect(selection, 'members', format)) return;
    setWasTrimmed(false);
    commit({ ...selection, showMembers: !selection.showMembers }, format);
  }, [selection, format, commit]);

  const toggleStats = useCallback(() => {
    if (!selection) return;
    if (!selection.showStats && !canSelect(selection, 'stats', format)) return;
    const next = selection.showStats
      ? { ...selection, showStats: false, showShoppingStat: false }
      : { ...selection, showStats: true };
    setWasTrimmed(false);
    commit(next, format);
  }, [selection, format, commit]);

  const toggleShoppingStat = useCallback(() => {
    if (!selection || !selection.showStats) return;
    setWasTrimmed(false);
    commit({ ...selection, showShoppingStat: !selection.showShoppingStat }, format);
  }, [selection, format, commit]);

  const resetToDefaults = useCallback(() => {
    if (!candidates) return;
    setWasTrimmed(false);
    commit(deriveDefaultSelection(candidates, format), format);
  }, [candidates, format, commit]);

  const canAdd = useCallback(
    (kind: SelectableKind) => (selection ? canSelect(selection, kind, format) : false),
    [selection, format],
  );

  return {
    selection,
    format,
    setFormat,
    toggleItem,
    setAccommodation,
    toggleMembers,
    toggleStats,
    toggleShoppingStat,
    resetToDefaults,
    canAdd,
    wasTrimmed,
    slotsUsed: selection ? computeSlotUsage(selection) : 0,
    slotBudget: SLOT_BUDGETS[format],
  };
}
