import type { PlayerStats, MinutesValuePlayer } from "@/app/types";

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

/** Adjust stats based on pen/intl toggles. Returns new array. */
export function applyStatsToggles(
  players: PlayerStats[],
  opts: { includePen: boolean; includeIntl: boolean },
): PlayerStats[] {
  return players.map((p) => {
    const rawGoals = p.goals + (opts.includeIntl ? p.intlGoals : 0);
    const assists = p.assists + (opts.includeIntl ? p.intlAssists : 0);
    const penAdj = opts.includePen
      ? 0
      : p.penaltyGoals + (opts.includeIntl ? p.intlPenaltyGoals : 0);
    const goals = rawGoals - penAdj;
    return {
      ...p,
      goals,
      assists,
      points: goals + assists,
      minutes: (p.minutes ?? 0) + (opts.includeIntl ? p.intlMinutes : 0),
      matches: p.matches + (opts.includeIntl ? p.intlAppearances : 0),
    };
  });
}

/** Fold a player's major-tournament national-team stats into their season totals
 *  so leaderboards and the player profile match the /players default. Goals/
 *  assists/penalties/minutes fold in and the intl* fields are zeroed so nothing
 *  can re-add them. Matches stay club-only (availability counts club fixtures),
 *  and recentForm already carries major-tournament games from the aggregator, so
 *  recent-form windows are unaffected here. */
export function includeTournamentStats(p: MinutesValuePlayer): MinutesValuePlayer {
  if (!p.intlGoals && !p.intlAssists && !p.intlMinutes && !p.intlPenaltyGoals) return p;
  return {
    ...p,
    goals: p.goals + (p.intlGoals ?? 0),
    assists: p.assists + (p.intlAssists ?? 0),
    penaltyGoals: (p.penaltyGoals ?? 0) + (p.intlPenaltyGoals ?? 0),
    minutes: p.minutes + (p.intlMinutes ?? 0),
    intlGoals: 0,
    intlAssists: 0,
    intlPenaltyGoals: 0,
    intlMinutes: 0,
  };
}
