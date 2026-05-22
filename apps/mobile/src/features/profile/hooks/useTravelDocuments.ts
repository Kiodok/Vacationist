import { useQuery } from '@tanstack/react-query';
import { getMyTravelDocuments } from '@vacationist/api';

export function useTravelDocuments(enabled = true) {
  return useQuery({
    queryKey: ['travelDocuments'],
    queryFn: getMyTravelDocuments,
    staleTime: 0,
    gcTime: 0,
    retry: 2,
    enabled,
  });
}
