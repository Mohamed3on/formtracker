import type { MinutesValuePlayer } from "@/app/types";

export interface RegressionReport {
  /** Players whose drop looks like a real scrape failure. */
  scattered: MinutesValuePlayer[];
  /** Clubs where most players regressed together (likely TM match void/postpone). */
  ignoredClubs: string[];
  /** Players ignored because their whole club regressed. */
  ignoredCount: number;
  /** Tolerated count of scattered drops before failing. */
  maxScattered: number;
  /** True when scattered drops exceed maxScattered — caller should fail. */
  fail: boolean;
}

export const MINUTES_DROP_TOLERANCE = 5;

/**
 * Classify per-player minute regressions as either:
 *   1. Whole-club corrections (TM voids/postpones a match → all club players lose ~90'), or
 *   2. Scattered individual drops (legit TM stat tweaks, tolerated up to a cap), or
 *   3. A real scrape failure (`fail: true`).
 */
export function analyzeMinutesRegressions(
  oldPlayers: MinutesValuePlayer[],
  newPlayers: MinutesValuePlayer[],
): RegressionReport {
  const oldById = new Map(oldPlayers.map((p) => [p.playerId, p]));
  const regressed = newPlayers.filter((p) => {
    const old = oldById.get(p.playerId);
    return !!old && old.minutes - p.minutes > MINUTES_DROP_TOLERANCE;
  });

  const clubKey = (p: MinutesValuePlayer) => p.club ?? "?";
  const totalByClub = new Map<string, number>();
  for (const p of newPlayers) totalByClub.set(clubKey(p), (totalByClub.get(clubKey(p)) ?? 0) + 1);
  const regressedByClub = new Map<string, number>();
  for (const p of regressed)
    regressedByClub.set(clubKey(p), (regressedByClub.get(clubKey(p)) ?? 0) + 1);

  const wholeClub = new Set<string>();
  for (const [club, n] of regressedByClub) {
    if (n >= 3 && n / (totalByClub.get(club) ?? 1) >= 0.5) wholeClub.add(club);
  }
  const scattered = regressed.filter((p) => !wholeClub.has(clubKey(p)));
  const maxScattered = Math.max(10, Math.floor(newPlayers.length * 0.02));

  return {
    scattered,
    ignoredClubs: [...wholeClub].sort(),
    ignoredCount: regressed.length - scattered.length,
    maxScattered,
    fail: scattered.length > maxScattered,
  };
}

export function sampleRegressionDrops(
  oldPlayers: MinutesValuePlayer[],
  regressed: MinutesValuePlayer[],
  n = 5,
): string {
  const oldById = new Map(oldPlayers.map((p) => [p.playerId, p]));
  return regressed
    .slice(0, n)
    .map((p) => `${p.name} (${oldById.get(p.playerId)!.minutes}' → ${p.minutes}')`)
    .join(", ");
}
