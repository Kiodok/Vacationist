import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppForeground } from '../../../hooks/useAppForeground';
import { subscribeToRecipesRealtime, unsubscribeFromRecipes } from '@vacationist/api';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Recipe } from '@vacationist/types';

const BACKOFF_DELAYS = [2000, 5000, 10000, 30000];

export function useRecipesRealtime(tripId: string) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffIndexRef = useRef(0);

  const queryKey = ['trips', tripId, 'recipes'];

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      unsubscribeFromRecipes(channelRef.current);
      channelRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const subscribe = useCallback(() => {
    cleanup();

    const channel = subscribeToRecipesRealtime(tripId, {
      onInsert: (recipe) => {
        queryClient.setQueryData<(Recipe & { ingredient_count: number })[]>(queryKey, (old) => {
          if (!old) return [{ ...recipe, ingredient_count: 0 }];
          if (old.some((r) => r.id === recipe.id)) return old;
          return [...old, { ...recipe, ingredient_count: 0 }];
        });
      },
      onUpdate: (recipe) => {
        queryClient.setQueryData<(Recipe & { ingredient_count: number })[]>(queryKey, (old) =>
          old?.map((r) => (r.id === recipe.id ? { ...r, ...recipe } : r)),
        );
        queryClient.invalidateQueries({ queryKey: ['recipes', recipe.id] });
      },
      onDelete: (oldRecipe) => {
        queryClient.setQueryData<(Recipe & { ingredient_count: number })[]>(queryKey, (old) =>
          old?.filter((r) => r.id !== oldRecipe.id),
        );
        queryClient.removeQueries({ queryKey: ['recipes', oldRecipe.id] });
      },
    }, (status) => {
      if (status === 'SUBSCRIBED') {
        backoffIndexRef.current = 0;
        queryClient.invalidateQueries({ queryKey });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        const delay = BACKOFF_DELAYS[Math.min(backoffIndexRef.current, BACKOFF_DELAYS.length - 1)];
        backoffIndexRef.current++;
        reconnectTimerRef.current = setTimeout(() => subscribe(), delay);
      }
    });

    channelRef.current = channel;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, queryClient, cleanup]);

  useAppForeground(() => {
    subscribe();
    queryClient.invalidateQueries({ queryKey });
  }, !!tripId);

  useEffect(() => {
    if (!tripId) return;
    subscribe();
    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, subscribe, cleanup]);
}
