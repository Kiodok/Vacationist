import { queryClient } from './queryClient';
import {
  createActivity,
  castActivityVote,
  castAccommodationVote,
  castTransferFlightVote,
} from '@vacationist/api';
import type {
  Activity,
  ActivityVote,
  AccommodationVote,
  TransferFlightVote,
  CreateActivityVariables,
  CastActivityVoteVariables,
  CastAccommodationVoteVariables,
  CastTransferFlightVoteVariables,
} from '@vacationist/types';

queryClient.setMutationDefaults(['createActivity'], {
  mutationFn: ({ tripId, input }: CreateActivityVariables) => createActivity(tripId, input),
  onSuccess: (_data: Activity, { tripId }: CreateActivityVariables) => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'activities'] });
  },
});

queryClient.setMutationDefaults(['castActivityVote'], {
  mutationFn: ({ vote, activityId }: CastActivityVoteVariables) => castActivityVote(activityId, vote),
  onSuccess: (_data: ActivityVote, { activityId, tripId }: CastActivityVoteVariables) => {
    queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'votes'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'activities'] });
  },
});

queryClient.setMutationDefaults(['castAccommodationVote'], {
  mutationFn: ({ vote, accommodationId }: CastAccommodationVoteVariables) =>
    castAccommodationVote(accommodationId, vote),
  onSuccess: (_data: AccommodationVote, { accommodationId, tripId }: CastAccommodationVoteVariables) => {
    queryClient.invalidateQueries({ queryKey: ['accommodations', accommodationId, 'votes'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'accommodations'] });
  },
});

queryClient.setMutationDefaults(['castTransferFlightVote'], {
  mutationFn: ({ vote, flightId }: CastTransferFlightVoteVariables) =>
    castTransferFlightVote(flightId, vote),
  onSuccess: (_data: TransferFlightVote, { flightId, tripId }: CastTransferFlightVoteVariables) => {
    queryClient.invalidateQueries({ queryKey: ['transfer-flights', flightId, 'votes'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-flights'] });
  },
});
