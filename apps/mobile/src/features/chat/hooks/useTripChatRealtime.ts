import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppForeground } from '../../../hooks/useAppForeground';
import { subscribeToMessages, unsubscribeFromMessages, getMessageById } from '@vacationist/api';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { TripMessage } from '@vacationist/types';
import {
  resolveOptimistic,
  replaceMessage,
  removeMessage,
  type MessagesData,
} from '../utils/messageCache';

export function useTripChatRealtime(tripId: string) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const queryKey = ['trips', tripId, 'messages'];

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      unsubscribeFromMessages(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  // Realtime payloads carry encrypted BYTEA in the text field — unusable directly.
  // Re-fetch via get_trip_message_by_id RPC to get the decrypted TripMessageWithSender.
  const fetchAndMergeInsert = useCallback(async (message: TripMessage) => {
    try {
      const decrypted = await getMessageById(message.id);
      if (!decrypted) return;
      queryClient.setQueryData<MessagesData>(queryKey, (old) => resolveOptimistic(old, decrypted));
    } catch {
      // Silently ignore realtime fetch errors — the optimistic message from
      // useCreateMessage is already in the cache; next manual refresh will sync.
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, queryClient]);

  const fetchAndMergeUpdate = useCallback(async (message: TripMessage) => {
    if (message.deleted_at) {
      queryClient.setQueryData<MessagesData>(queryKey, (old) =>
        old && removeMessage(old, message.id),
      );
      return;
    }
    try {
      const decrypted = await getMessageById(message.id);
      if (!decrypted) return;
      queryClient.setQueryData<MessagesData>(queryKey, (old) => {
        if (!old) return old;
        return replaceMessage(old, decrypted);
      });
    } catch {
      // Ignore — stale cache entry is acceptable until next refresh.
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, queryClient]);

  const subscribe = useCallback(() => {
    cleanup();

    const channel = subscribeToMessages(tripId, {
      onInsert: (message) => { void fetchAndMergeInsert(message); },
      onUpdate: (message) => { void fetchAndMergeUpdate(message); },
    });

    channelRef.current = channel;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, queryClient, cleanup, fetchAndMergeInsert, fetchAndMergeUpdate]);

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
