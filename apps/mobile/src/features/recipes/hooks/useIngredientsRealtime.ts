import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppForeground } from '../../../hooks/useAppForeground';
import { subscribeToIngredientsRealtime, unsubscribeFromIngredients } from '@vacationist/api';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { RecipeWithIngredients, RecipeIngredient, Recipe } from '@vacationist/types';

const BACKOFF_DELAYS = [2000, 5000, 10000, 30000];

export function useIngredientsRealtime(recipeId: string, tripId: string) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffIndexRef = useRef(0);

  const recipeKey = ['recipes', recipeId];
  const recipesListKey = ['trips', tripId, 'recipes'];

  const updateIngredientCount = useCallback(
    (delta: number) => {
      queryClient.setQueryData<(Recipe & { ingredient_count: number })[]>(
        recipesListKey,
        (old) =>
          old?.map((r) =>
            r.id === recipeId
              ? { ...r, ingredient_count: Math.max(0, r.ingredient_count + delta) }
              : r,
          ),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recipeId, tripId, queryClient],
  );

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      unsubscribeFromIngredients(channelRef.current);
      channelRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const subscribe = useCallback(() => {
    cleanup();

    const channel = subscribeToIngredientsRealtime(recipeId, {
      onInsert: (ingredient) => {
        queryClient.setQueryData<RecipeWithIngredients>(recipeKey, (old) => {
          if (!old) return old;
          if (old.recipe_ingredients.some((i) => i.id === ingredient.id)) return old;
          const updated = [...old.recipe_ingredients, ingredient].sort(
            (a, b) => a.sort_order - b.sort_order,
          );
          return { ...old, recipe_ingredients: updated, ingredient_count: updated.length };
        });
        updateIngredientCount(1);
      },
      onUpdate: (ingredient) => {
        queryClient.setQueryData<RecipeWithIngredients>(recipeKey, (old) => {
          if (!old) return old;
          const updated = old.recipe_ingredients
            .map((i) => (i.id === ingredient.id ? ingredient : i))
            .sort((a, b) => a.sort_order - b.sort_order);
          return { ...old, recipe_ingredients: updated };
        });
      },
      onDelete: (oldIngredient) => {
        queryClient.setQueryData<RecipeWithIngredients>(recipeKey, (old) => {
          if (!old) return old;
          const filtered = old.recipe_ingredients.filter((i) => i.id !== oldIngredient.id);
          return { ...old, recipe_ingredients: filtered, ingredient_count: filtered.length };
        });
        updateIngredientCount(-1);
      },
    }, (status) => {
      if (status === 'SUBSCRIBED') {
        backoffIndexRef.current = 0;
        queryClient.invalidateQueries({ queryKey: recipeKey });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        const delay = BACKOFF_DELAYS[Math.min(backoffIndexRef.current, BACKOFF_DELAYS.length - 1)];
        backoffIndexRef.current++;
        reconnectTimerRef.current = setTimeout(() => subscribe(), delay);
      }
    });

    channelRef.current = channel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId, tripId, queryClient, cleanup, updateIngredientCount]);

  useAppForeground(() => {
    subscribe();
    queryClient.invalidateQueries({ queryKey: recipeKey });
  }, !!recipeId);

  useEffect(() => {
    if (!recipeId) return;
    subscribe();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId, subscribe, cleanup]);
}
