import { useState, useCallback } from 'react';

interface UseCollapsibleSectionsOptions {
  defaultCollapsed?: string[];
}

interface UseCollapsibleSectionsReturn {
  toggle: (key: string) => void;
  expand: (key: string) => void;
  isCollapsed: (key: string) => boolean;
}

export function useCollapsibleSections(
  options: UseCollapsibleSectionsOptions = {},
): UseCollapsibleSectionsReturn {
  const { defaultCollapsed = ['completed', 'archived'] } = options;

  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(
    () => new Set(defaultCollapsed),
  );

  const toggle = useCallback((key: string) => {
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const expand = useCallback((key: string) => {
    setCollapsedKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const isCollapsed = useCallback(
    (key: string) => collapsedKeys.has(key),
    [collapsedKeys],
  );

  return { toggle, expand, isCollapsed };
}
