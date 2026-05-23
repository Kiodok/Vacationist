import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import { subscribeToExpensesRealtime, unsubscribeFromExpenses } from '@vacationist/api';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { ExpenseWithSplits } from '@vacationist/types';

const BACKOFF_DELAYS = [2000, 5000, 10000, 30000];
const DEBOUNCE_MS = 300;

export function useExpensesRealtime(tripId: string) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffIndexRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      unsubscribeFromExpenses(channelRef.current);
      channelRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'expenses'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'balances'] });
  }, [queryClient, tripId]);

  const debouncedInvalidate = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      invalidateAll();
    }, DEBOUNCE_MS);
  }, [invalidateAll]);

  const reconcile = useCallback(() => {
    invalidateAll();
  }, [invalidateAll]);

  const isSplitForThisTrip = useCallback(
    (expenseId: string | null): boolean => {
      if (!expenseId) return false;
      const cached = queryClient.getQueryData<InfiniteData<{ items: ExpenseWithSplits[]; hasMore: boolean }>>(
        ['trips', tripId, 'expenses'],
      );
      if (!cached) return true;
      const allExpenses = cached.pages.flatMap((p) => p.items);
      return allExpenses.some((e) => e.id === expenseId);
    },
    [queryClient, tripId],
  );

  const subscribe = useCallback(() => {
    cleanup();

    const channel = subscribeToExpensesRealtime(
      tripId,
      {
        onExpenseChange: () => {
          debouncedInvalidate();
        },
        onSplitChange: (expenseId) => {
          if (isSplitForThisTrip(expenseId)) {
            if (expenseId) {
              queryClient.invalidateQueries({
                queryKey: ['expenses', expenseId, 'splits'],
              });
            }
            debouncedInvalidate();
          }
        },
      },
      (status) => {
        if (status === 'SUBSCRIBED') {
          backoffIndexRef.current = 0;
          reconcile();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          const delay =
            BACKOFF_DELAYS[
              Math.min(backoffIndexRef.current, BACKOFF_DELAYS.length - 1)
            ];
          backoffIndexRef.current++;
          reconnectTimerRef.current = setTimeout(() => {
            subscribe();
            reconcile();
          }, delay);
        }
      },
    );

    channelRef.current = channel;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, queryClient, cleanup, reconcile, debouncedInvalidate, isSplitForThisTrip]);

  useEffect(() => {
    if (!tripId) return;

    subscribe();

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        subscribe();
        reconcile();
      }
    });

    return () => {
      cleanup();
      appStateSubscription.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, subscribe, cleanup, reconcile]);
}
