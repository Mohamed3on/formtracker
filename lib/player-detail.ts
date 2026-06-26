import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { MarketValueMover, MinutesValuePlayer, PlayerStats } from "@/app/types";
import { findRepeatLosers, findRepeatWinners } from "@/lib/biggest-movers";
import {
  applyStatsToggles,
  getMinutesValueData,
  includeTournamentStats,
  toPlayerStats,
} from "@/lib/fetch-minutes-value";
import {
  buildLeagueValues,
  filterMinutesBenchmark,
  getFormStats,
  gamesScheduled,
  isSameOrStrongerLeague,
  missedPct,
} from "@/lib/filter-players";
import { extractClubIdFromLogoUrl, formatMarketValue } from "@/lib/format";
import { normalizeForSearch } from "@/lib/normalize";
import {
  canBeOutperformerAgainst,
  canBeUnderperformerAgainst,
  effectivePosition,
  getBroadPositionGroup,
  getBroadPositionLabel,
  getBroadPositionShortLabel,
  strictlyOutperforms,
} from "@/lib/positions";
import { MIN_COMPARISON_COUNT, countComparisons } from "@/lib/value-analysis";

export interface PlayerRankings {
  marketValueOverall: number;
  marketValueLeague: number;
  marketValueClub: number;
  marketValuePosition: number;
  goalsOverall: number;
  goalsLeague: number;
  goalsClub: number;
  goalsPosition: number;
  assistsOverall: number;
  assistsLeague: number;
  assistsClub: number;
  assistsPosition: number;
  pointsOverall: number;
  pointsLeague: number;
  pointsClub: number;
  pointsPosition: number;
  npgaOverall: number;
  npgaLeague: number;
  npgaClub: number;
  npgaPosition: number;
  minutesOverall: number;
  minutesLeague: number;
  minutesClub: number;
  minutesPosition: number;
  form5Overall: number;
  form5League: number;
  form5Club: number;
  form5Position: number;
  form10Overall: number;
  form10League: number;
  form10Club: number;
  form10Position: number;
}

export interface PlayerFormSummary {
  seasonNpga: number;
  seasonGa: number;
  seasonGoals: number;
  seasonAssists: number;
  seasonMinutes: number;
  penaltyGoals: number;
  penaltyAttempts: number;
  penaltyConversion: number | null;
  last5Npga: number;
  last5Goals: number;
  last5PenaltyGoals: number;
  last5Assists: number;
  last5Minutes: number;
  last10Npga: number;
  last10Goals: number;
  last10PenaltyGoals: number;
  last10Assists: number;
  last10Minutes: number;
}

export interface PlayerTrend {
  type: "winner" | "loser";
  appearances: MarketValueMover[];
  totalAbsoluteChange: number;
  latestAbsoluteChange: number;
}

export interface PlayerSignalSummary {
  availablePct: number;
  gamesScheduled: number;
  gamesMissed: number;
  cheaperPlayersBeatingTarget: number;
  pricierPlayersBeatenByTarget: number;
  discoveryStatus: "bargain" | "overpriced" | null;
  discoveryThreshold: number;
}

export interface MinutesBenchmark {
  playingLess: MinutesValuePlayer[];
  playingMore: MinutesValuePlayer[];
  playingLessCount: number;
  playingMoreCount: number;
}

export interface SubgroupRanking {
  label: string;
  npgaRank: number;
  marketValueRank: number;
  minutesRank: number;
  total: number;
}

import type { ComparisonScope } from "./comparison-scope";

export interface ScopedComparison {
  outperformers: PlayerStats[];
  underperformers: PlayerStats[];
  signalSummary: PlayerSignalSummary;
}

export interface PlayerDetailData {
  player: MinutesValuePlayer;
  playerStats: PlayerStats;
  injury: null;
  clubId: string | null;
  rankings: PlayerRankings;
  positionLabel: string;
  positionShortLabel: string;
  positionPeerCount: number;
  overallCount: number;
  leagueCount: number;
  clubCount: number;
  form: PlayerFormSummary;
  comparisons: Record<ComparisonScope, ScopedComparison>;
  trend: PlayerTrend | null;
  clubmates: MinutesValuePlayer[];
  topClubmatesByNpga: MinutesValuePlayer[];
  minutesBenchmark: MinutesBenchmark;
  subgroupRankings: SubgroupRanking[];
  penaltyRank: { rank: number; total: number } | null;
}

export function seasonNpga(p: MinutesValuePlayer): number {
  return p.goals - (p.penaltyGoals ?? 0) + p.assists;
}

function compareByMetric(
  playerId: string,
  players: MinutesValuePlayer[],
  metric: (player: MinutesValuePlayer) => number,
): number {
  const target = players.find((p) => p.playerId === playerId);
  if (!target) return players.length;
  const targetScore = metric(target);
  let rank = 1;
  for (const p of players) {
    if (p.playerId !== playerId && metric(p) > targetScore) rank++;
  }
  return rank;
}

function findTargetPlayer(
  players: MinutesValuePlayer[],
  playerId: string,
): MinutesValuePlayer | null {
  const byId = players.find((player) => player.playerId === playerId);
  if (byId) return byId;

  const normalized = normalizeForSearch(playerId);
  return players.find((player) => normalizeForSearch(player.name) === normalized) ?? null;
}

function buildTrend(
  playerId: string,
  winners: Awaited<ReturnType<typeof findRepeatWinners>>,
  losers: Awaited<ReturnType<typeof findRepeatLosers>>,
): PlayerTrend | null {
  const winnerSequence = winners.repeatMovers.find((appearances) =>
    appearances.some((appearance) => appearance.playerId === playerId),
  );
  if (winnerSequence) {
    const appearances = [...winnerSequence].sort((left, right) =>
      right.period.localeCompare(left.period),
    );
    return {
      type: "winner",
      appearances,
      totalAbsoluteChange: appearances.reduce(
        (sum, appearance) => sum + appearance.absoluteChange,
        0,
      ),
      latestAbsoluteChange: appearances[0]?.absoluteChange ?? 0,
    };
  }

  const loserSequence = losers.repeatMovers.find((appearances) =>
    appearances.some((appearance) => appearance.playerId === playerId),
  );
  if (!loserSequence) return null;

  const appearances = [...loserSequence].sort((left, right) =>
    right.period.localeCompare(left.period),
  );
  return {
    type: "loser",
    appearances,
    totalAbsoluteChange: appearances.reduce(
      (sum, appearance) => sum + appearance.absoluteChange,
      0,
    ),
    latestAbsoluteChange: appearances[0]?.absoluteChange ?? 0,
  };
}

function buildRankings(
  player: MinutesValuePlayer,
  allPlayers: MinutesValuePlayer[],
  leaguePlayers: MinutesValuePlayer[],
  clubPlayers: MinutesValuePlayer[],
  positionPlayers: MinutesValuePlayer[],
): PlayerRankings {
  const totalPoints = (p: MinutesValuePlayer) => p.goals + p.assists;
  const rank = (pool: MinutesValuePlayer[], metric: (p: MinutesValuePlayer) => number) =>
    compareByMetric(player.playerId, pool, metric);

  const form5Npga = (p: MinutesValuePlayer) => getFormStats(p, 5).npga;
  const form10Npga = (p: MinutesValuePlayer) => getFormStats(p, 10).npga;
  const metrics = [
    { prefix: "marketValue", fn: (p: MinutesValuePlayer) => p.marketValue },
    { prefix: "goals", fn: (p: MinutesValuePlayer) => p.goals },
    { prefix: "assists", fn: (p: MinutesValuePlayer) => p.assists },
    { prefix: "points", fn: totalPoints },
    { prefix: "npga", fn: seasonNpga },
    { prefix: "minutes", fn: (p: MinutesValuePlayer) => p.minutes },
    { prefix: "form5", fn: form5Npga },
    { prefix: "form10", fn: form10Npga },
  ] as const;

  const result: Record<string, number> = {};
  for (const { prefix, fn } of metrics) {
    result[`${prefix}Overall`] = rank(allPlayers, fn);
    result[`${prefix}League`] = rank(leaguePlayers, fn);
    result[`${prefix}Club`] = rank(clubPlayers, fn);
    result[`${prefix}Position`] = rank(positionPlayers, fn);
  }
  return result as unknown as PlayerRankings;
}

function buildFormSummary(player: MinutesValuePlayer): PlayerFormSummary {
  const penGoals = player.penaltyGoals ?? 0;
  const penMisses = player.penaltyMisses ?? 0;
  const penAttempts = penGoals + penMisses;
  const f5 = getFormStats(player, 5);
  const f10 = getFormStats(player, 10);
  return {
    seasonNpga: seasonNpga(player),
    seasonGa: player.goals + player.assists,
    seasonGoals: player.goals,
    seasonAssists: player.assists,
    seasonMinutes: player.minutes,
    penaltyGoals: penGoals,
    penaltyAttempts: penAttempts,
    penaltyConversion: penAttempts > 0 ? Math.round((penGoals / penAttempts) * 100) : null,
    last5Npga: f5.npga,
    last5Goals: f5.goals,
    last5PenaltyGoals: f5.penaltyGoals,
    last5Assists: f5.assists,
    last5Minutes: f5.minutes,
    last10Npga: f10.npga,
    last10Goals: f10.goals,
    last10PenaltyGoals: f10.penaltyGoals,
    last10Assists: f10.assists,
    last10Minutes: f10.minutes,
  };
}

function sortOutperformers(players: PlayerStats[]): PlayerStats[] {
  return [...players].sort(
    (left, right) =>
      right.points - left.points ||
      left.marketValue - right.marketValue ||
      left.minutes! - right.minutes!,
  );
}

function sortUnderperformers(players: PlayerStats[]): PlayerStats[] {
  return [...players].sort(
    (left, right) =>
      right.marketValue - left.marketValue ||
      left.points - right.points ||
      right.minutes! - left.minutes!,
  );
}

function stripRecentForm({ recentForm: _, ...rest }: MinutesValuePlayer): MinutesValuePlayer {
  return rest;
}

async function computePlayerDetailData(playerId: string): Promise<PlayerDetailData | null> {
  const [rawPlayers, winners, losers] = await Promise.all([
    getMinutesValueData(),
    findRepeatWinners(),
    findRepeatLosers(),
  ]);
  const players = rawPlayers.map(includeTournamentStats);

  const player = findTargetPlayer(players, playerId);
  if (!player) return null;

  const clubId = extractClubIdFromLogoUrl(player.clubLogoUrl);
  const playerBroadPosition = getBroadPositionGroup(effectivePosition(player));
  const positionLabel = getBroadPositionLabel(effectivePosition(player));
  const positionShortLabel = getBroadPositionShortLabel(effectivePosition(player));

  // Single pass to build all player pools
  const clubmates: MinutesValuePlayer[] = [];
  const leaguePlayers: MinutesValuePlayer[] = [];
  const positionPlayers: MinutesValuePlayer[] = [];
  for (const candidate of players) {
    if (candidate.league === player.league) leaguePlayers.push(candidate);
    if (getBroadPositionGroup(effectivePosition(candidate)) === playerBroadPosition)
      positionPlayers.push(candidate);
    const matchesClub = clubId
      ? extractClubIdFromLogoUrl(candidate.clubLogoUrl) === clubId
      : candidate.club === player.club && candidate.league === player.league;
    if (matchesClub) clubmates.push(candidate);
  }

  const playerStats = toPlayerStats(player);
  const comparisonPlayers = applyStatsToggles(players.map(toPlayerStats), { includePen: false });
  const comparisonTarget =
    comparisonPlayers.find((candidate) => candidate.playerId === player.playerId) ?? playerStats;
  const targetPosition = effectivePosition(comparisonTarget);
  const underperformers = sortUnderperformers(
    comparisonPlayers.filter(
      (candidate) =>
        candidate.playerId !== comparisonTarget.playerId &&
        candidate.marketValue >= comparisonTarget.marketValue &&
        strictlyOutperforms(comparisonTarget, candidate) &&
        canBeUnderperformerAgainst(effectivePosition(candidate), targetPosition),
    ),
  );
  const outperformers = sortOutperformers(
    comparisonPlayers.filter(
      (candidate) =>
        candidate.playerId !== comparisonTarget.playerId &&
        candidate.marketValue <= comparisonTarget.marketValue &&
        strictlyOutperforms(candidate, comparisonTarget) &&
        canBeOutperformerAgainst(effectivePosition(candidate), targetPosition),
    ),
  );

  const baseSignal = {
    availablePct: Math.max(0, 100 - Math.round(missedPct(player) * 100)),
    gamesScheduled: gamesScheduled(player),
    gamesMissed: player.gamesMissed ?? 0,
    discoveryThreshold: MIN_COMPARISON_COUNT,
  };

  const buildScope = (pool: PlayerStats[]): ScopedComparison => {
    const cheaper = countComparisons(comparisonTarget, pool, false);
    const pricier = countComparisons(comparisonTarget, pool, true);
    const inPool = new Set(pool.map((p) => p.playerId));
    return {
      outperformers: outperformers.filter((p) => inPool.has(p.playerId)).slice(0, 6),
      underperformers: underperformers.filter((p) => inPool.has(p.playerId)).slice(0, 6),
      signalSummary: {
        ...baseSignal,
        cheaperPlayersBeatingTarget: cheaper,
        pricierPlayersBeatenByTarget: pricier,
        discoveryStatus:
          pricier >= MIN_COMPARISON_COUNT
            ? "bargain"
            : cheaper >= MIN_COMPARISON_COUNT
              ? "overpriced"
              : null,
      },
    };
  };

  const leagueValues = buildLeagueValues(comparisonPlayers);
  const comparisons: Record<ComparisonScope, ScopedComparison> = {
    all: buildScope(comparisonPlayers),
    league: buildScope(comparisonPlayers.filter((p) => p.league === comparisonTarget.league)),
    sameOrStronger: buildScope(
      comparisonPlayers.filter(isSameOrStrongerLeague(leagueValues, comparisonTarget.league)),
    ),
  };

  const topClubmatesByNpga = [...clubmates]
    .sort((left, right) => {
      const diff = seasonNpga(right) - seasonNpga(left);
      if (diff !== 0) return diff;
      return left.minutes - right.minutes || left.name.localeCompare(right.name);
    })
    .slice(0, 6);

  const { playingLess, playingMore } = filterMinutesBenchmark(players, player);

  // Subgroup rankings (loan players, new signings)
  const subgroupRankings: SubgroupRanking[] = [];
  if (player.isOnLoan) {
    const loanPlayers = players.filter((p) => p.isOnLoan);
    if (loanPlayers.length > 1) {
      subgroupRankings.push({
        label: "Loan players",
        npgaRank: compareByMetric(player.playerId, loanPlayers, seasonNpga),
        marketValueRank: compareByMetric(player.playerId, loanPlayers, (p) => p.marketValue),
        minutesRank: compareByMetric(player.playerId, loanPlayers, (p) => p.minutes),
        total: loanPlayers.length,
      });
    }
  }
  if (player.isNewSigning && !player.isOnLoan) {
    const newSignings = players.filter((p) => p.isNewSigning && !p.isOnLoan);
    if (newSignings.length > 1) {
      subgroupRankings.push({
        label: "New signings",
        npgaRank: compareByMetric(player.playerId, newSignings, seasonNpga),
        marketValueRank: compareByMetric(player.playerId, newSignings, (p) => p.marketValue),
        minutesRank: compareByMetric(player.playerId, newSignings, (p) => p.minutes),
        total: newSignings.length,
      });
    }
  }

  return {
    player,
    playerStats,
    injury: null,
    clubId,
    rankings: buildRankings(player, players, leaguePlayers, clubmates, positionPlayers),
    positionLabel,
    positionShortLabel,
    positionPeerCount: positionPlayers.length,
    overallCount: players.length,
    leagueCount: leaguePlayers.length,
    clubCount: clubmates.length,
    form: buildFormSummary(player),
    comparisons,
    trend: buildTrend(player.playerId, winners, losers),
    clubmates: clubmates.map(stripRecentForm),
    topClubmatesByNpga: topClubmatesByNpga.map(stripRecentForm),
    minutesBenchmark: {
      playingLess: playingLess.slice(0, 10).map(stripRecentForm),
      playingMore: playingMore.slice(0, 10).map(stripRecentForm),
      playingLessCount: playingLess.length,
      playingMoreCount: playingMore.length,
    },
    subgroupRankings,
    penaltyRank:
      (player.penaltyGoals ?? 0) > 0
        ? (() => {
            const penaltyTakers = players.filter((p) => (p.penaltyGoals ?? 0) > 0);
            return {
              rank: compareByMetric(player.playerId, penaltyTakers, (p) => p.penaltyGoals ?? 0),
              total: penaltyTakers.length,
            };
          })()
        : null,
  };
}

export const getPlayerDetailData = cache((playerId: string) =>
  unstable_cache(() => computePlayerDetailData(playerId), [`player-detail-v5-${playerId}`], {
    revalidate: 43200,
    tags: ["form-analysis"],
  })(),
);

export function formatTrendLabel(trend: PlayerTrend): string {
  const updates = trend.appearances.length;
  const amount = formatMarketValue(trend.totalAbsoluteChange);
  return trend.type === "winner"
    ? `${updates} repeat rises · +${amount} total`
    : `${updates} repeat drops · -${amount} total`;
}
