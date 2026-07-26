import type { ComboboxGroup } from "@/components/Combobox";
import { effectivePosition, getPositionClassRank } from "@/lib/positions";

export const TOP_5_LEAGUES = ["Premier League", "LaLiga", "Bundesliga", "Serie A", "Ligue 1"];

/** Build sorted Combobox options from a list of items, with an "All ..." default. */
export function uniqueFilterOptions<T>(
  items: T[],
  accessor: (item: T) => string | undefined,
  allLabel: string,
) {
  return [
    { value: "all", label: allLabel },
    ...Array.from(new Set(items.map(accessor).filter(Boolean)))
      .sort()
      .map((v) => ({ value: v!, label: v! })),
  ];
}

/** Total market value per league — the ranking that sorts the players-page league list and judges league strength. */
export function buildLeagueValues<T extends { league: string }>(
  players: T[],
  getValue: (p: T) => number = (p) => (p as { marketValue?: number }).marketValue ?? 0,
): Map<string, number> {
  const value = new Map<string, number>();
  for (const p of players)
    if (p.league) value.set(p.league, (value.get(p.league) ?? 0) + getValue(p));
  return value;
}

/** Build league options for Combobox: quick filters (All / Top 5) + one list of leagues sorted by total market value. */
export function buildLeagueGroups<T extends { league: string }>(
  players: T[],
  getValue: (p: T) => number = (p) => (p as { marketValue?: number }).marketValue ?? 0,
): ComboboxGroup[] {
  const value = buildLeagueValues(players, getValue);
  const leagues = [...value.keys()].sort((a, b) => (value.get(b) ?? 0) - (value.get(a) ?? 0));
  return [
    {
      options: [
        { value: "all", label: "All leagues" },
        { value: "top5", label: "Top 5 leagues" },
      ],
    },
    ...(leagues.length ? [{ options: leagues.map((l) => ({ value: l, label: l })) }] : []),
  ];
}

export function filterPlayersByLeagueAndClub<T extends { league: string; club: string }>(
  players: T[],
  leagueFilter: string,
  clubFilter: string,
): T[] {
  return players.filter((player) => {
    if (leagueFilter === "top5") {
      if (!TOP_5_LEAGUES.includes(player.league)) return false;
    } else if (leagueFilter !== "all" && player.league !== leagueFilter) return false;
    if (clubFilter !== "all" && clubFilter && player.club !== clubFilter) return false;
    return true;
  });
}

/** Predicate: a player's league is the target's league or a stronger one (ranked by total market value). */
export function isSameOrStrongerLeague(
  leagueValues: Map<string, number>,
  targetLeague: string,
): (p: { league: string }) => boolean {
  const threshold = leagueValues.get(targetLeague) ?? 0;
  return (p) => (leagueValues.get(p.league) ?? 0) >= threshold;
}

export function getFormMinutes(
  player: { minutes: number; recentForm?: { minutes: number }[] },
  window: "season" | number,
): number {
  if (window === "season") return player.minutes;
  return (player.recentForm ?? []).slice(0, window).reduce((s, g) => s + g.minutes, 0);
}

export function getFormNpga(
  player: { recentForm?: { goals: number; assists: number; penaltyGoals: number }[] },
  window: number,
): number {
  return (player.recentForm ?? [])
    .slice(0, window)
    .reduce((s, g) => s + g.goals - (g.penaltyGoals ?? 0) + g.assists, 0);
}

export function getFormGoals(player: { recentForm?: { goals: number }[] }, window: number): number {
  return (player.recentForm ?? []).slice(0, window).reduce((s, g) => s + g.goals, 0);
}

export function getFormAssists(
  player: { recentForm?: { assists: number }[] },
  window: number,
): number {
  return (player.recentForm ?? []).slice(0, window).reduce((s, g) => s + g.assists, 0);
}

/** Single-pass form stats for a window — avoids 4 separate traversals. */
export function getFormStats(
  player: {
    recentForm?: { goals: number; assists: number; penaltyGoals: number; minutes: number }[];
  },
  window: number,
): { goals: number; assists: number; penaltyGoals: number; npga: number; minutes: number } {
  const games = (player.recentForm ?? []).slice(0, window);
  let goals = 0,
    assists = 0,
    penaltyGoals = 0,
    npga = 0,
    minutes = 0;
  for (const g of games) {
    goals += g.goals;
    assists += g.assists;
    penaltyGoals += g.penaltyGoals ?? 0;
    npga += g.goals - (g.penaltyGoals ?? 0) + g.assists;
    minutes += g.minutes;
  }
  return { goals, assists, penaltyGoals, npga, minutes };
}

/** Total games the player's team has played this season. */
export function gamesScheduled(p: {
  totalMatches: number;
  gamesMissed?: number;
  totalGames?: number;
}): number {
  return p.totalGames ?? p.totalMatches + (p.gamesMissed ?? 0);
}

/** Games the player was available for (not injured/suspended/absent). */
export function gamesAvailable(p: {
  totalMatches: number;
  gamesMissed?: number;
  totalGames?: number;
}): number {
  return gamesScheduled(p) - (p.gamesMissed ?? 0);
}

/** Games available including major-tournament games, for the "played X of Y"
 *  lines. totalMatches already folds in tournament games (see
 *  includeTournamentStats), so this folds intlAppearances into the available
 *  count too — a tournament game counts as available-and-played. % missed stays
 *  club-based (gamesAvailable derives from club totalGames, not totalMatches). */
export function displayAvailable(p: {
  totalMatches: number;
  gamesMissed?: number;
  totalGames?: number;
  intlAppearances?: number;
}): number {
  return gamesAvailable(p) + (p.intlAppearances ?? 0);
}

/** Value constraint for minutes benchmark peers. Default (undefined) keeps the per-list
 *  behavior: pricier-or-equal for "playing less", cheaper-or-equal for "playing more". */
export type MinutesValueFilter = "pricier" | "cheaper" | "any";

/** Split players into those playing less and more minutes than the target, sorted for display.
 *  "Playing less" = same-or-higher value, available for same-or-more games yet fewer minutes (had opportunity but didn't play).
 *  "Playing more" = same-or-lower value, available for same-or-fewer games yet more minutes (played more despite less opportunity/value).
 *  Pass `valueFilter` to override the value constraint on both lists ("any" drops it entirely).
 *  Position rank is also enforced so e.g. CBs (who naturally play more) aren't compared against CFs. */
export function filterMinutesBenchmark<
  T extends {
    playerId: string;
    marketValue: number;
    minutes: number;
    totalMatches: number;
    gamesMissed?: number;
    totalGames?: number;
    position: string;
    playedPosition?: string;
  },
>(
  players: T[],
  target: T,
  valueFilter?: MinutesValueFilter,
): { playingLess: T[]; playingMore: T[] } {
  const benchAvail = gamesAvailable(target);
  const targetRank = getPositionClassRank(effectivePosition(target));
  const valueOk = (p: T, fallback: MinutesValueFilter) => {
    const filter = valueFilter ?? fallback;
    if (filter === "any") return true;
    return filter === "pricier"
      ? p.marketValue >= target.marketValue
      : p.marketValue <= target.marketValue;
  };
  const playingLess: T[] = [];
  const playingMore: T[] = [];
  for (const p of players) {
    if (p.playerId === target.playerId) continue;
    const pAvail = gamesAvailable(p);
    const pPos = effectivePosition(p);
    const pRank = getPositionClassRank(pPos);
    if (p.minutes <= target.minutes) {
      if (valueOk(p, "pricier") && pAvail >= benchAvail && pRank <= targetRank) playingLess.push(p);
    } else {
      if (
        valueOk(p, "cheaper") &&
        pAvail <= benchAvail &&
        pRank >= targetRank &&
        pPos !== "Goalkeeper"
      )
        playingMore.push(p);
    }
  }
  playingLess.sort((a, b) => a.minutes - b.minutes || b.marketValue - a.marketValue);
  playingMore.sort((a, b) => b.marketValue - a.marketValue || b.minutes - a.minutes);
  return { playingLess, playingMore };
}

/** Fraction of games missed (0–1). Players with 0 matches and 0 minutes are treated as 100% unavailable. */
export function missedPct(p: {
  totalMatches: number;
  minutes: number;
  gamesMissed?: number;
  totalGames?: number;
}): number {
  const total = gamesScheduled(p);
  if (total === 0) return p.minutes === 0 ? 1 : 0;
  return (p.gamesMissed ?? 0) / total;
}
