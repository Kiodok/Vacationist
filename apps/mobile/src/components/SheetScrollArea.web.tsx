import type { ReactElement } from 'react';

/**
 * Web build: no sheet gesture, so this is a pure passthrough — the scrollable
 * renders exactly as it did before.
 */
export function SheetScrollArea({ children }: { children: ReactElement }) {
  return children;
}
