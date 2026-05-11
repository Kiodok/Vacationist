import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

let toastCounter = 0;

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  addToast: (type, message) => {
    const id = `toast-${++toastCounter}`;
    const toast: Toast = { id, type, message };

    set((state) => {
      const updated = [...state.toasts, toast].slice(-2);
      return { toasts: updated };
    });

    if (type === 'success') {
      setTimeout(() => {
        get().removeToast(id);
      }, 3000);
    }
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearAll: () => set({ toasts: [] }),
}));
