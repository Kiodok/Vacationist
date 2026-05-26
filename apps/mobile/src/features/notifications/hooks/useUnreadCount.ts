import { useQuery } from '@tanstack/react-query';
import { getUnreadCount } from '@vacationist/api';

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => getUnreadCount(),
    retry: 2,
    refetchInterval: 30_000,
  });
}

export function useTripUnreadCount(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'notifications', 'unread-count'],
    queryFn: () => getUnreadCount(tripId),
    retry: 2,
    enabled: !!tripId,
    refetchInterval: 30_000,
  });
}
