import type { PlayerStats, MinutesValuePlayer } from "@/app/types";

/** Non-penalty goals + assists — the app's one scoring metric. Every surface
 *  (home picks, squad tables, player detail, WC scorers, form windows) derives
 *  it from here; pass `includePenalties` for toggles that keep pens in. */
export function npga(
  p: { goals: number; assists: number; penaltyGoals?: number },
  opts?: { includePenalties?: boolean },
): number {
  return p.goals - (opts?.includePenalties ? 0 : (p.penaltyGoals ?? 0)) + p.assists;
}

export function toPlayerStats(p: MinutesValuePlayer): PlayerStats {
  return {
    name: p.name,
    position: p.position,
    playedPosition:
      p.playedPosition && p.playedPosition !== p.position ? p.playedPosition : undefined,
    age: p.age,
    club: p.club,
    clubLogoUrl: p.clubLogoUrl ?? "",
    league: p.league,
    matches: p.totalMatches,
    goals: p.goals,
    assists: p.assists,
    penaltyGoals: p.penaltyGoals ?? 0,
    penaltyMisses: p.penaltyMisses ?? 0,
    intlGoals: p.intlGoals ?? 0,
    intlAssists: p.intlAssists ?? 0,
    intlMinutes: p.intlMinutes ?? 0,
    intlAppearances: p.intlAppearances ?? 0,
    intlPenaltyGoals: p.intlPenaltyGoals ?? 0,
    intlCareerCaps: p.intlCareerCaps ?? 0,
    points: p.goals + p.assists,
    marketValue: p.marketValue,
    marketValueDisplay: p.marketValueDisplay,
    profileUrl: p.profileUrl,
    imageUrl: p.imageUrl,
    playerId: p.playerId,
    minutes: p.minutes,
    isNewSigning: p.isNewSigning,
    isOnLoan: p.isOnLoan,
    nationality: p.nationality,
    nationalityFlagUrl: p.nationalityFlagUrl,
  };
}

/** Drop penalty goals from the goal/point totals when penalties are excluded.
 *  Tournament national-team stats are folded in at the data source via
 *  includeTournamentStats, so there is no intl toggle here. Returns a new array. */
export function applyStatsToggles(
  players: PlayerStats[],
  opts: { includePen: boolean },
): PlayerStats[] {
  return players.map((p) => {
    const goals = p.goals - (opts.includePen ? 0 : p.penaltyGoals);
    return { ...p, goals, points: goals + p.assists };
  });
}

/** Fold a player's major-tournament national-team stats into their season totals
 *  so leaderboards, tables and the profile all count World Cup/Euros/… play.
 *  Goals/assists/penalties/minutes/matches fold in and those intl* scalars are
 *  zeroed so nothing can re-add them. intlAppearances is left in place (it's now
 *  part of totalMatches) because the "played X of Y" availability denominator
 *  still needs it via displayAvailable(); recentForm/positionStats already carry
 *  tournament games from the aggregator. */
export function includeTournamentStats(p: MinutesValuePlayer): MinutesValuePlayer {
  if (!p.intlGoals && !p.intlAssists && !p.intlMinutes && !p.intlPenaltyGoals) return p;
  return {
    ...p,
    goals: p.goals + (p.intlGoals ?? 0),
    assists: p.assists + (p.intlAssists ?? 0),
    penaltyGoals: (p.penaltyGoals ?? 0) + (p.intlPenaltyGoals ?? 0),
    minutes: p.minutes + (p.intlMinutes ?? 0),
    totalMatches: p.totalMatches + (p.intlAppearances ?? 0),
    intlGoals: 0,
    intlAssists: 0,
    intlPenaltyGoals: 0,
    intlMinutes: 0,
  };
}
