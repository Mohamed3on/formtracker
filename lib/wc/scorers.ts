import type { MinutesValuePlayer } from "@/app/types";

/** Transfermarkt's competition id for the World Cup finals. Filtering per-game on
 *  this keeps friendlies, qualifiers, and every other tournament out — narrower
 *  than the `intl*` aggregates, which fold in all six senior major finals. */
export const WC_COMPETITION_ID = "FIWC";

/** A World Cup scorer, with every stat scoped to World-Cup-only games. */
export interface WcScorer {
  playerId: string;
  name: string;
  nationality: string;
  flagUrl?: string;
  imageUrl: string;
  club: string;
  clubLogoUrl: string;
  goals: number;
  penaltyGoals: number;
  assists: number;
  minutes: number;
  apps: number;
}

/**
 * Build the World Cup scorer pool from the minutes-value dataset. Each player's
 * tally is summed from their per-game `recentForm`, filtered to the World Cup
 * (`FIWC`) — so friendlies/qualifiers/other tournaments never leak in. We keep
 * only players who registered a goal or assist; the client sorts and slices from
 * there (by npG+A / goals / assists / minutes, with a penalties toggle).
 *
 * Aggregating server-side matters: `slimForClient` strips `competitionId` from
 * `recentForm`, so the World Cup filter has to run before the data is trimmed.
 */
export function buildWcScorers(players: MinutesValuePlayer[]): WcScorer[] {
  const scorers: WcScorer[] = [];
  for (const p of players) {
    const games = (p.recentForm ?? []).filter((g) => g.competitionId === WC_COMPETITION_ID);
    if (!games.length) continue;
    const goals = games.reduce((s, g) => s + (g.goals ?? 0), 0);
    const assists = games.reduce((s, g) => s + (g.assists ?? 0), 0);
    if (goals + assists === 0) continue; // a scorer list: contributors only
    scorers.push({
      playerId: p.playerId,
      name: p.name,
      nationality: p.nationality,
      flagUrl: p.nationalityFlagUrl,
      imageUrl: p.imageUrl,
      club: p.club,
      clubLogoUrl: p.clubLogoUrl,
      goals,
      penaltyGoals: games.reduce((s, g) => s + (g.penaltyGoals ?? 0), 0),
      assists,
      minutes: games.reduce((s, g) => s + (g.minutes ?? 0), 0),
      apps: games.length,
    });
  }
  return scorers;
}
