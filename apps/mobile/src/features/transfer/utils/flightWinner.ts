import type { TransferFlight, TransferFlightVote } from '@vacationist/types';
import { VOTE_SCORE } from '../../../utils/voteScores';

function pickWinner(
  flights: TransferFlight[],
  votesByFlightId: Record<string, TransferFlightVote[]>,
): string | null {
  const eligible = flights.filter((f) => {
    if (f.voting_open || f.deleted_at) return false;
    const votes = votesByFlightId[f.id] ?? [];
    return !votes.some((v) => v.vote === 'group_blocker');
  });

  if (eligible.length === 0) return null;

  return eligible.reduce<TransferFlight | null>((best, f) => {
    if (!best) return f;
    const fVotes = votesByFlightId[f.id] ?? [];
    const bestVotes = votesByFlightId[best.id] ?? [];

    const fAvg = fVotes.length === 0 ? 0 : fVotes.reduce((s, v) => s + (VOTE_SCORE[v.vote] ?? 0), 0) / fVotes.length;
    const bestAvg = bestVotes.length === 0 ? 0 : bestVotes.reduce((s, v) => s + (VOTE_SCORE[v.vote] ?? 0), 0) / bestVotes.length;

    if (fAvg > bestAvg) return f;
    if (fAvg === bestAvg && fVotes.length > bestVotes.length) return f;
    if (fAvg === bestAvg && fVotes.length === bestVotes.length && f.created_at < best.created_at) return f;
    return best;
  }, null)?.id ?? null;
}

export function computeFlightWinner(
  flights: TransferFlight[],
  votesByFlightId: Record<string, TransferFlightVote[]>,
): Record<string, string | null> {
  const outbound = flights.filter((f) => f.direction === 'outbound');
  const ret = flights.filter((f) => f.direction === 'return');
  const outboundReturn = flights.filter((f) => f.direction === 'outbound-return');
  return {
    outbound: pickWinner(outbound, votesByFlightId),
    return: pickWinner(ret, votesByFlightId),
    'outbound-return': pickWinner(outboundReturn, votesByFlightId),
  };
}
