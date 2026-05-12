import { create } from 'zustand';
import type { User } from '@vacationist/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  hasSession: boolean;
  pendingInviteToken: string | null;
}

interface AuthActions {
  setUser: (user: User | null) => void;
  setHasSession: (hasSession: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  setPendingInviteToken: (token: string | null) => void;
  reset: () => void;
}

const initialState: AuthState = {
  user: null,
  isLoading: true,
  hasSession: false,
  pendingInviteToken: null,
};

export const useAuthStore = create<AuthState & AuthActions>()((set) => ({
  ...initialState,
  setUser: (user) => set({ user }),
  setHasSession: (hasSession) => set({ hasSession }),
  setLoading: (isLoading) => set({ isLoading }),
  setPendingInviteToken: (token) => set({ pendingInviteToken: token }),
  reset: () => set({ ...initialState, isLoading: false }),
}));
