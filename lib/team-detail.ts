import { cache } from "react";
import type { AggregatedTeam, MinutesValuePlayer, TeamFormEntry, TeamStats } from "@/app/types";
import {
  getMinutesValueData,
  applyStatsToggles,
  includeTournamentStats,
  toPlayerStats,
} from "@/lib/fetch-minutes-value";
import { getTeamFormData } from "@/lib/team-form";
import { getAnalysis } from "@/lib/form-analysis";
import { findRepeatWinners, findRepeatLosers } from "@/lib/biggest-movers";
import { extractClubIdFromLogoUrl } from "@/lib/format";
import { findValueCandidates, type ValueCandidate } from "@/lib/value-analysis";
import type { MarketValueMover } from "@/app/types";

export interface TeamDetailData {
  clubId: string;
  name: string;
  logoUrl: string;
  league: string;
  clubUrl: string;
  teamForm: TeamFormEntry | null;
  squad: MinutesValuePlayer[];
  squadValue: number;
  formPresence: { type: "top" | "bottom"; category: string; periods: number[] }[];
  recentForm: {
    period: number;
    stats: TeamStats;
    totalTeams: number;
    ranks: { points: number; goalDiff: number; goalsScored: number; goalsConceded: number };
  }[];
  overperformers: ValueCandidate[];
  underperformers: ValueCandidate[];
  trendPlayers: {
    player: MinutesValuePlayer;
    type: "winner" | "loser";
    appearances: MarketValueMover[];
  }[];
}

async function computeTeamDetailData(clubId: string): Promise<TeamDetailData | null> {
  const [teamFormResult, playersResult, analysisResult, winnersResult, losersResult] =
    await Promise.allSettled([
      getTeamFormData(),
      getMinutesValueData(),
      getAnalysis(),
      findRepeatWinners(),
      findRepeatLosers(),
    ]);

  const teamFormData = teamFormResult.status === "fulfilled" ? teamFormResult.value : null;
  // Fold major-tournament national-team stats so the squad and its
  // over/underperformer comparison count World Cup/Euros/… play by default.
  const players = (playersResult.status === "fulfilled" ? playersResult.value : []).map(
    includeTournamentStats,
  );
  const analysisData = analysisResult.status === "fulfilled" ? analysisResult.value : null;
  const winners = winnersResult.status === "fulfilled" ? winnersResult.value : null;
  const losers = losersResult.status === "fulfilled" ? losersResult.value : null;

  // Find team in allTeams
  const teamForm = teamFormData?.allTeams?.find((t) => t.clubId === clubId) ?? null;

  // Filter squad players by clubId
  const squad = players.filter((p) => extractClubIdFromLogoUrl(p.clubLogoUrl) === clubId);

  if (!teamForm && squad.length === 0) return null;

  const name = teamForm?.name ?? squad[0]?.club ?? "";
  const logoUrl = teamForm?.logoUrl ?? squad[0]?.clubLogoUrl ?? "";
  const league = teamForm?.league ?? squad[0]?.league ?? "";
  const clubUrl = teamForm?.clubUrl ?? "";

  const squadValue = squad.reduce((sum, p) => sum + p.marketValue, 0);

  // Form presence from aggregated analysis
  const formPresence: TeamDetailData["formPresence"] = [];
  const addPresence = (teams: AggregatedTeam[], type: "top" | "bottom") => {
    const match = teams.find((t) => t.clubId === clubId);
    if (!match) return;
    const catMap = new Map<string, number[]>();
    for (const entry of match.entries) {
      const existing = catMap.get(entry.category);
      if (existing) existing.push(entry.period);
      else catMap.set(entry.category, [entry.period]);
    }
    for (const [category, periods] of catMap) {
      formPresence.push({ type, category, periods });
    }
  };
  if (analysisData) {
    addPresence(analysisData.aggregatedTop, "top");
    addPresence(analysisData.aggregatedBottom, "bottom");
  }

  // Recent form stats across all time windows with per-metric ranks
  const recentForm: TeamDetailData["recentForm"] = [];
  if (analysisData?.allTeamsPerPeriod) {
    for (const { period, teams: periodTeams } of analysisData.allTeamsPerPeriod) {
      const teamStats = periodTeams.find((t) => t.clubId === clubId);
      if (!teamStats) continue;
      const rankBy = (metric: (t: TeamStats) => number, desc = true) => {
        const val = metric(teamStats);
        return periodTeams.filter((t) => (desc ? metric(t) > val : metric(t) < val)).length + 1;
      };
      recentForm.push({
        period,
        stats: teamStats,
        totalTeams: periodTeams.length,
        ranks: {
          points: rankBy((t) => t.points),
          goalDiff: rankBy((t) => t.goalDiff),
          goalsScored: rankBy((t) => t.goalsScored),
          goalsConceded: rankBy((t) => -t.goalsConceded),
        },
      });
    }
  }

  // Over/underperformers — reuse exact same logic as the value analysis page
  const comparisonPlayers = applyStatsToggles(players.map(toPlayerStats), {
    includePen: false,
    includeIntl: false,
  });
  const clubPlayerIds = new Set(squad.map((p) => p.playerId));

  const allOverperformers = findValueCandidates(comparisonPlayers, {
    candidateOutperforms: true,
    sortAsc: true,
  });
  const allUnderperformers = findValueCandidates(comparisonPlayers, {
    candidateOutperforms: false,
    sortAsc: false,
  });

  const overperformers = allOverperformers
    .filter((p) => clubPlayerIds.has(p.playerId))
    .sort((a, b) => b.count - a.count);
  const underperformers = allUnderperformers
    .filter((p) => clubPlayerIds.has(p.playerId))
    .sort((a, b) => b.count - a.count);

  // Trend players from repeat winners/losers
  const trendPlayers: TeamDetailData["trendPlayers"] = [];
  const addTrends = (
    movers: { repeatMovers: MarketValueMover[][] } | null,
    type: "winner" | "loser",
  ) => {
    if (!movers) return;
    for (const appearances of movers.repeatMovers) {
      const matching = appearances.filter((a) => clubPlayerIds.has(a.playerId));
      if (matching.length === 0) continue;
      const playerId = matching[0].playerId;
      const player = squad.find((p) => p.playerId === playerId);
      if (player) {
        trendPlayers.push({ player, type, appearances: matching });
      }
    }
  };
  addTrends(winners, "winner");
  addTrends(losers, "loser");

  return {
    clubId,
    name,
    logoUrl,
    league,
    clubUrl,
    teamForm,
    squad: [...squad]
      .sort((a, b) => b.marketValue - a.marketValue)
      .map(({ recentForm: _, ...rest }) => rest),
    squadValue,
    formPresence,
    recentForm,
    overperformers,
    underperformers,
    trendPlayers,
  };
}

export const getTeamDetailData = cache(computeTeamDetailData);
