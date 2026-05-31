import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppForeground } from '../../../hooks/useAppForeground';
import {
  subscribeToShoppingItems,
  subscribeToShoppingSync,
  unsubscribeFromShoppingItems,
} from '@vacationist/api';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { ShoppingItem } from '@vacationist/types';

const RECONNECT_DELAY_MS = 3000;

export function useShoppingRealtime(listId: string) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const syncChannelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queryKey = ['shopping-lists', listId, 'items'];

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      unsubscribeFromShoppingItems(channelRef.current);
      channelRef.current = null;
    }
    if (syncChannelRef.current) {
      unsubscribeFromShoppingItems(syncChannelRef.current);
      syncChannelRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const subscribe = useCallback(() => {
    cleanup();

    const channel = subscribeToShoppingItems(listId, {
      onInsert: (item) => {
        queryClient.setQueryData<ShoppingItem[]>(queryKey, (old) => {
          if (!old) return [item];
          if (old.some((i) => i.id === item.id)) return old;
          return [...old, item];
        });
      },
      onUpdate: (item) => {
        if (item.deleted_at) {
          queryClient.setQueryData<ShoppingItem[]>(queryKey, (old) =>
            old?.filter((i) => i.id !== item.id),
          );
          return;
        }
        queryClient.setQueryData<ShoppingItem[]>(queryKey, (old) =>
          old?.map((i) => (i.id === item.id ? item : i)),
        );
      },
      onDelete: (oldItem) => {
        queryClient.setQueryData<ShoppingItem[]>(queryKey, (old) =>
          old?.filter((i) => i.id !== oldItem.id),
        );
      },
    });

    channelRef.current = channel;

    const syncChannel = subscribeToShoppingSync(listId, (ids) => {
      queryClient.setQueryData<ShoppingItem[]>(queryKey, (old) =>
        old?.filter((i) => !ids.includes(i.id)),
      );
    });
    syncChannelRef.current = syncChannel;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId, queryClient, cleanup]);

  useAppForeground(() => {
    subscribe();
    queryClient.invalidateQueries({ queryKey });
  }, !!listId);

  useEffect(() => {
    if (!listId) return;
    subscribe();
    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId, subscribe, cleanup]);
}
