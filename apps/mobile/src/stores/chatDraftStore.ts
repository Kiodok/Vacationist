import { create } from 'zustand';

/**
 * In-progress Trip Chat message text, keyed by trip id. In-memory only (no MMKV
 * persistence) — this only needs to survive switching between the virtual tabs on
 * `apps/mobile/app/trip/[id]/index.tsx` (which fully unmounts the non-active tab, destroying any
 * local component state), not an app kill/restart. UI state, not server data, so it belongs in
 * Zustand per the strict TanStack Query / Zustand boundary.
 */
interface ChatDraftStore {
  draftsByTripId: Record<string, string>;
  setDraft: (tripId: string, text: string) => void;
  clearDraft: (tripId: string) => void;
}

export const useChatDraftStore = create<ChatDraftStore>((set) => ({
  draftsByTripId: {},

  setDraft: (tripId, text) =>
    set((state) => ({
      draftsByTripId: { ...state.draftsByTripId, [tripId]: text },
    })),

  clearDraft: (tripId) =>
    set((state) => {
      if (!(tripId in state.draftsByTripId)) return state;
      const { [tripId]: _removed, ...rest } = state.draftsByTripId;
      return { draftsByTripId: rest };
    }),
}));
