import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppForeground } from '../../../hooks/useAppForeground';
import { subscribeToMessages, unsubscribeFromMessages } from '@vacationist/api';
import type { TripMemberWithUser } from '@vacationist/api';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { TripMessageWithSender } from '@vacationist/types';
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

  const subscribe = useCallback(() => {
    cleanup();

    const channel = subscribeToMessages(tripId, {
      onInsert: (message) => {
        // Realtime payloads carry no users join — the sender of a live
        // message is always a current member, so enrich from the members cache.
        const members = queryClient.getQueryData<TripMemberWithUser[]>(['trips', tripId, 'members']);
        const senderUser = members?.find((m) => m.user_id === message.created_by)?.user;
        const enriched: TripMessageWithSender = {
          ...message,
          sender: senderUser ? { name: senderUser.name, avatar_url: senderUser.avatar_url } : null,
        };
        queryClient.setQueryData<MessagesData>(queryKey, (old) => resolveOptimistic(old, enriched));
      },
      onUpdate: (message) => {
        if (message.deleted_at) {
          queryClient.setQueryData<MessagesData>(queryKey, (old) =>
            old && removeMessage(old, message.id),
          );
          return;
        }
        queryClient.setQueryData<MessagesData>(queryKey, (old) =>
          old && replaceMessage(old, message),
        );
      },
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
