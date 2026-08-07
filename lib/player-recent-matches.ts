import { LEAGUE_NAMES, type RecentGameStats } from "./player-aggregation";

/**
 * Fills remaining gaps in a player's stored recent matches (competition names).
 * Opponent names/logos are pre-populated by the refresh script via clubs.json;
 * nothing here touches the network.
 */
export function enrichRecentMatches(matches: RecentGameStats[]): RecentGameStats[] {
  return matches.map((match) => ({
    ...match,
    competitionName:
      match.competitionName ||
      (match.competitionId ? LEAGUE_NAMES[match.competitionId] : undefined),
  }));
}
