import type { VoteType } from '@vacationist/types';

export const VOTE_SCORE: Record<VoteType, number> = {
  must_do: 2,
  like: 1,
  open: 0,
  skip: -1,
  group_blocker: -2,
};
