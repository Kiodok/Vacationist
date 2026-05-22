import { useQuery } from '@tanstack/react-query';
import { getUnreadCount } from '@vacationist/api';

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => getUnreadCount(),
    refetchInterval: 30_000,
    retry: 2,
  });
}

export function useTripUnreadCount(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'notifications', 'unread-count'],
    queryFn: () => getUnreadCount(tripId),
    refetchInterval: 30_000,
    retry: 2,
    enabled: !!tripId,
  });
}
