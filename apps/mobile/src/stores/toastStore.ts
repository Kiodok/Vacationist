import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface AddToastOptions {
  /** Auto-dismiss after this many ms. Defaults: 3000 for `success`, 5000 for `warning`, none (tap to
   * dismiss) for `error` — an error is something the user must have seen; a warning is advisory. */
  durationMs?: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, options?: AddToastOptions) => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

let toastCounter = 0;

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  addToast: (type, message, options) => {
    // The same message already on screen is not stacked again. A paused-offline write used to raise one
    // identical "could not be saved" toast per attempt, piling two on top of each other that never went away.
    if (get().toasts.some((t) => t.type === type && t.message === message)) return;

    const id = `toast-${++toastCounter}`;
    const toast: Toast = { id, type, message };

    set((state) => {
      const updated = [...state.toasts, toast].slice(-2);
      return { toasts: updated };
    });

    const durationMs = options?.durationMs ?? (type === 'success' ? 3000 : type === 'warning' ? 5000 : undefined);
    if (durationMs) {
      setTimeout(() => {
        get().removeToast(id);
      }, durationMs);
    }
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearAll: () => set({ toasts: [] }),
}));
