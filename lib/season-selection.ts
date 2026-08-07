import type { CeapiGame } from "./player-aggregation";

// TM's date-based season flips Aug 1 while the big leagues are still weeks from
// kickoff. Keep aggregating the previous season until this share of fetched
// players have stats in the new one (~the first full round of league games).
export const SEASON_FLIP_COVERAGE = 0.35;
// ceapi returns each player's full career, so a healthy scrape carries
// last-season stats for nearly everyone. Below this the payloads themselves are
// broken (the old ">30% zero stats" guard, made season-rollover-proof).
export const PREV_SEASON_MIN_COVERAGE = 0.7;
// Coverage guards only fire on a meaningful sample.
const MIN_FETCHED_FOR_GUARD = 50;

export type SeasonSource = { data: { rawGames?: CeapiGame[] } };

function hasSeasonStats(entry: SeasonSource, seasonId: number): boolean {
  return !!entry.data.rawGames?.some(
    (g) =>
      g.gameInformation.seasonId === seasonId &&
      ((g.statistics.playingTimeStatistics.playedMinutes ?? 0) > 0 ||
        (g.statistics.goalStatistics.goalsScoredTotal ?? 0) > 0 ||
        (g.statistics.goalStatistics.assists ?? 0) > 0),
  );
}

/** Share of fetched players with any played game in the given season. */
export function seasonCoverage(
  cache: Record<string, SeasonSource>,
  playerIds: string[],
  seasonId: number,
): number {
  const fetched = playerIds.filter((id) => cache[id]);
  if (fetched.length === 0) return 0;
  return fetched.filter((id) => hasSeasonStats(cache[id], seasonId)).length / fetched.length;
}

/** Pick the season to aggregate: the date-based candidate once it has real
 *  coverage, else the previous one. Doubles as the scraper-health check:
 *  full-career payloads mean last-season coverage stays near 100% forever, so
 *  a low value is broken ceapi data, not a young season. */
export function chooseSeason(
  cache: Record<string, SeasonSource>,
  playerIds: string[],
  candidate: number,
): number {
  const candCoverage = seasonCoverage(cache, playerIds, candidate);
  const prevCoverage = seasonCoverage(cache, playerIds, candidate - 1);
  console.log(
    `[refresh] Season coverage: ${candidate} ${(candCoverage * 100).toFixed(0)}%, ${candidate - 1} ${(prevCoverage * 100).toFixed(0)}%`,
  );
  const fetchedCount = playerIds.filter((id) => cache[id]).length;
  if (fetchedCount > MIN_FETCHED_FOR_GUARD && prevCoverage < PREV_SEASON_MIN_COVERAGE) {
    throw new Error(
      `Only ${(prevCoverage * 100).toFixed(0)}% of players have last-season stats — ceapi payloads look broken.`,
    );
  }
  return candCoverage >= SEASON_FLIP_COVERAGE ? candidate : candidate - 1;
}
