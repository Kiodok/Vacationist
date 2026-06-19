import { colors } from '@vacationist/ui';
import type { VoteType } from '@vacationist/types';
import { VOTE_SCORE } from './voteScores';
export { VOTE_SCORE } from './voteScores';

const COLORFUL_OPEN_YELLOW = '#D4A017';
const COLORFUL_SUCCESS_GREEN = '#00A864';

export function getVoteBorderColor(votes: { vote: VoteType }[], isColorful = false): string {
  if (votes.length === 0) return colors.border;
  if (votes.some((v) => v.vote === 'group_blocker')) return colors.danger;

  const avg = votes.reduce((sum, v) => sum + VOTE_SCORE[v.vote], 0) / votes.length;
  const rounded = Math.round(avg);

  if (rounded >= 2) return isColorful ? COLORFUL_SUCCESS_GREEN : colors.success;
  if (rounded >= 1) return colors.primary;
  if (rounded >= 0) return isColorful ? COLORFUL_OPEN_YELLOW : colors.border;
  return isColorful ? colors.danger : colors.warning;
}
