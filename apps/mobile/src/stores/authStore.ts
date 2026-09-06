import { create } from 'zustand';
import type { User } from '@vacationist/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  hasSession: boolean;
  /**
   * Offline launch, credentials present, but the 7-day trust window lapsed.
   * `<AuthGate>` renders `<OfflineReauthGate>` instead of the app or the login
   * screen while this is true (Phase 19).
   */
  offlineReauthRequired: boolean;
  pendingInviteToken: string | null;
  pushToken: string | null;
}

interface AuthActions {
  setUser: (user: User | null) => void;
  setHasSession: (hasSession: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  setOfflineReauthRequired: (required: boolean) => void;
  setPendingInviteToken: (token: string | null) => void;
  setPushToken: (token: string | null) => void;
  reset: () => void;
}

const initialState: AuthState = {
  user: null,
  isLoading: true,
  hasSession: false,
  offlineReauthRequired: false,
  pendingInviteToken: null,
  pushToken: null,
};

export const useAuthStore = create<AuthState & AuthActions>()((set) => ({
  ...initialState,
  setUser: (user) => set({ user }),
  setHasSession: (hasSession) => set({ hasSession }),
  setLoading: (isLoading) => set({ isLoading }),
  setOfflineReauthRequired: (offlineReauthRequired) => set({ offlineReauthRequired }),
  setPendingInviteToken: (token) => set({ pendingInviteToken: token }),
  setPushToken: (token) => set({ pushToken: token }),
  reset: () => set({ ...initialState, isLoading: false }),
}));
