import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

type Cb = () => void;
const registry = new Set<Cb>();
let sub: ReturnType<typeof AppState.addEventListener> | null = null;

function attach() {
  if (sub) return;
  sub = AppState.addEventListener('change', (next) => {
    if (next === 'active') registry.forEach((cb) => cb());
  });
}

function detach() {
  if (!sub || registry.size > 0) return;
  sub.remove();
  sub = null;
}

export function useAppForeground(onForeground: Cb, enabled = true) {
  const ref = useRef(onForeground);
  ref.current = onForeground;

  useEffect(() => {
    if (!enabled) return;
    const cb: Cb = () => ref.current();
    registry.add(cb);
    attach();
    return () => {
      registry.delete(cb);
      detach();
    };
  }, [enabled]);
}

export function __resetForTesting() {
  registry.clear();
  if (sub) {
    sub.remove();
    sub = null;
  }
}
