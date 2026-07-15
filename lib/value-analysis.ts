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

/** Count how many players in `pool` the given player compares against. */
export function countComparisons(
  player: PlayerStats,
  pool: PlayerStats[],
  candidateOutperforms: boolean,
): number {
  const ep = pos(player);
  return pool.filter(
    (p) =>
      p.playerId !== player.playerId &&
      (candidateOutperforms
        ? p.marketValue >= player.marketValue &&
          strictlyOutperforms(player, p) &&
          canBeUnderperformerAgainst(pos(p), ep)
        : p.marketValue <= player.marketValue &&
          strictlyOutperforms(p, player) &&
          canBeOutperformerAgainst(pos(p), ep)),
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
