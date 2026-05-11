import { create } from 'zustand';
import type { User } from '@vacationist/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  hasSession: boolean;
}

interface AuthActions {
  setUser: (user: User | null) => void;
  setHasSession: (hasSession: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  reset: () => void;
}

const initialState: AuthState = {
  user: null,
  isLoading: true,
  hasSession: false,
};

export const useAuthStore = create<AuthState & AuthActions>()((set) => ({
  ...initialState,
  setUser: (user) => set({ user }),
  setHasSession: (hasSession) => set({ hasSession }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ ...initialState, isLoading: false }),
}));
