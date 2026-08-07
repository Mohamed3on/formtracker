import type { PlayerStats } from "@/app/types";
import {
  canBeUnderperformerAgainst,
  canBeOutperformerAgainst,
  effectivePosition as pos,
  isAttackingPosition,
  isDefensivePosition,
  strictlyOutperforms,
} from "@/lib/positions";

export type ValueCandidate = PlayerStats & { count: number };

export const MIN_COMPARISON_COUNT = 3;

type ValueComparable = {
  playerId: string;
  marketValue: number;
  points: number;
  minutes?: number;
  position: string;
  playedPosition?: string;
};

/** The bargain/overpriced rule, owned here and only here: `candidate` costs
 *  equal-or-more than `target` yet is strictly outperformed by it (at a
 *  position where that comparison is fair). */
export function underperformsTarget(
  candidate: ValueComparable,
  target: ValueComparable,
  targetPosition: string = pos(target),
): boolean {
  return (
    candidate.playerId !== target.playerId &&
    candidate.marketValue >= target.marketValue &&
    strictlyOutperforms(target, candidate) &&
    canBeUnderperformerAgainst(pos(candidate), targetPosition)
  );
}

/** Mirror rule: `candidate` costs equal-or-less yet strictly outperforms `target`. */
export function outperformsTarget(
  candidate: ValueComparable,
  target: ValueComparable,
  targetPosition: string = pos(target),
): boolean {
  return (
    candidate.playerId !== target.playerId &&
    candidate.marketValue <= target.marketValue &&
    strictlyOutperforms(candidate, target) &&
    canBeOutperformerAgainst(pos(candidate), targetPosition)
  );
}

/** Count how many players in `pool` the given player compares against. */
export function countComparisons(
  player: PlayerStats,
  pool: PlayerStats[],
  candidateOutperforms: boolean,
): number {
  const ep = pos(player);
  return pool.filter((p) =>
    candidateOutperforms ? underperformsTarget(p, player, ep) : outperformsTarget(p, player, ep),
  ).length;
}

/**
 * Find players who are either overperformers (bargains) or underperformers (overpriced).
 * When `candidateOutperforms` is true, finds cheap players outperforming expensive ones.
 * When false, finds expensive players outperformed by cheaper ones.
 */
export function findValueCandidates(
  players: PlayerStats[],
  {
    candidateOutperforms,
    minMinutes,
    sortAsc,
  }: {
    candidateOutperforms: boolean;
    minMinutes?: number;
    sortAsc: boolean;
  },
): ValueCandidate[] {
  const candidates: ValueCandidate[] = [];

  for (const player of players) {
    if (player.minutes === undefined) continue;
    if (minMinutes !== undefined && player.minutes < minMinutes) continue;
    if (candidateOutperforms ? isDefensivePosition(pos(player)) : !isAttackingPosition(pos(player)))
      continue;
    if (candidateOutperforms && player.goals - player.penaltyGoals <= 0) continue;

    const count = countComparisons(player, players, candidateOutperforms);
    if (count >= MIN_COMPARISON_COUNT) candidates.push({ ...player, count });
  }

  const undominated = candidates.filter(
    (player) =>
      !candidates.some(
        (other) =>
          other.playerId !== player.playerId &&
          (candidateOutperforms
            ? canBeUnderperformerAgainst(pos(player), pos(other)) &&
              other.marketValue <= player.marketValue &&
              strictlyOutperforms(other, player)
            : canBeUnderperformerAgainst(pos(other), pos(player)) &&
              other.marketValue >= player.marketValue &&
              strictlyOutperforms(player, other)),
      ),
  );

  return undominated.sort((a, b) =>
    sortAsc ? a.marketValue - b.marketValue : b.marketValue - a.marketValue,
  );
}
