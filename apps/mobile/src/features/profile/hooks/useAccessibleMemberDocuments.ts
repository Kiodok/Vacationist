import { useQuery } from '@tanstack/react-query';
import { getAccessibleMemberDocuments } from '@vacationist/api';

export function useAccessibleMemberDocuments(tripId: string, enabled = true) {
  return useQuery({
    queryKey: ['accessibleMemberDocuments', tripId],
    queryFn: () => getAccessibleMemberDocuments(tripId),
    staleTime: 0,
    gcTime: 0,
    retry: 2,
    enabled: !!tripId && enabled,
  });
}
