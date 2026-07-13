import type { InfiniteData } from '@tanstack/react-query';
import type { TripMessage, TripMessageWithSender, TripMessagesPage } from '@vacationist/types';
import { isOptimisticId } from '../../../utils/optimisticId';

// Shape of the ['trips', tripId, 'messages'] infinite-query cache:
// pages are newest-first, items within a page are created_at DESC.
export type MessagesData = InfiniteData<TripMessagesPage, string | undefined>;

export type MessagePatch = { id: string } & Partial<TripMessage> & {
  sender?: TripMessageWithSender['sender'];
};

function containsId(data: MessagesData, id: string): boolean {
  return data.pages.some((page) => page.items.some((item) => item.id === id));
}

export function prependMessage(
  data: MessagesData | undefined,
  message: TripMessageWithSender,
): MessagesData {
  if (!data || data.pages.length === 0) {
    return { pages: [{ items: [message], nextCursor: null }], pageParams: [undefined] };
  }
  if (containsId(data, message.id)) return data;
  const [first, ...rest] = data.pages;
  return { ...data, pages: [{ ...first, items: [message, ...first.items] }, ...rest] };
}

export function replaceMessage(data: MessagesData, patch: MessagePatch): MessagesData {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((item) =>
        // Realtime payloads carry no users join — keep the cached sender.
        item.id === patch.id ? { ...item, ...patch, sender: patch.sender ?? item.sender } : item,
      ),
    })),
  };
}

export function removeMessage(data: MessagesData, messageId: string): MessagesData {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.filter((item) => item.id !== messageId),
    })),
  };
}

/**
 * Insert a server-confirmed message, replacing its optimistic twin if one is
 * still in the cache. Handles both races: the realtime echo arriving before
 * the mutation's onSuccess, and vice versa (the second call is a no-op
 * because prependMessage dedupes by id).
 */
export function resolveOptimistic(
  data: MessagesData | undefined,
  message: TripMessageWithSender,
): MessagesData {
  if (!data) return prependMessage(data, message);

  let removed = false;
  const withoutOptimistic: MessagesData = {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.filter((item) => {
        if (removed) return true;
        const isTwin =
          isOptimisticId(item.id) &&
          item.created_by === message.created_by &&
          item.text === message.text;
        if (isTwin) {
          removed = true;
          return false;
        }
        return true;
      }),
    })),
  };
  return prependMessage(withoutOptimistic, message);
}
