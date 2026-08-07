import { BASE_URL } from "./constants";
import { extractClubIdFromLogoUrl } from "./format";

/** Pure aggregation of Transfermarkt ceapi per-game data into season stats.
 *  No I/O: everything here computes from already-fetched `CeapiGame[]`, which
 *  is what makes the season rules testable and lets the refresh re-aggregate
 *  cached games for any season without touching the network. Fetching lives in
 *  `lib/fetch-player-minutes.ts`; this module is the interface tests exercise. */

// --- Wire types (shape of ceapi's performance payload) ---

export interface CeapiGame {
  gameInformation: {
    gameId?: string;
    seasonId: number;
    competitionTypeId: number;
    competitionId: string;
    gameDay?: number;
    isNationalGame?: boolean;
    date?: { dateTimeUTC?: string };
  };
  clubsInformation?: {
    club?: {
      clubId?: string;
      venue?: "home" | "away";
      goalsTotal?: number | null;
      opponentGoalsTotal?: number | null;
    };
    opponent?: { clubId?: string };
  };
  statistics: {
    generalStatistics: {
      positionId?: number | null;
      participationState?: string | null;
    };
    goalStatistics: {
      goalsScoredTotal?: number | null;
      assists?: number | null;
      penaltyShooterGoalsScored?: number | null;
      penaltyShooterMisses?: number | null;
    };
    playingTimeStatistics: { playedMinutes?: number | null };
  };
}

export interface RecentGameStats {
  goals: number;
  assists: number;
  penaltyGoals: number;
  minutes: number;
  positionId?: number;
  date: string;
  gameId?: string;
  gameDay?: number;
  competitionId?: string;
  competitionName?: string;
  venue?: "home" | "away";
  teamGoals?: number;
  opponentGoals?: number;
  opponentClubId?: string;
  opponentName?: string;
  opponentLogoUrl?: string;
  matchReportUrl?: string;
}

export interface PlayerStatsResult {
  minutes: number;
  appearances: number;
  goals: number;
  /** Goals in top-flight leagues, cups & continental only (excludes 2nd-tier-and-below
   *  league goals). Used to gate scorer-pool players in the refresh. */
  topFlightGoals: number;
  assists: number;
  penaltyGoals: number;
  penaltyMisses: number;
  intlGoals: number;
  intlAssists: number;
  intlMinutes: number;
  intlAppearances: number;
  intlPenaltyGoals: number;
  club: string;
  clubLogoUrl: string;
  league: string;
  intlCareerCaps: number;
  isCurrentIntl: boolean;
  isNewSigning: boolean;
  isOnLoan: boolean;
  playedPosition: string;
  contractExpiry?: string;
  gamesMissed: number;
  totalGames: number;
  positionStats?: {
    positionId: number;
    position: string;
    minutes: number;
    goals: number;
    assists: number;
    appearances: number;
  }[];
  nationality?: string;
  nationalityFlagUrl?: string;
  leagueLogoUrl?: string;
  recentForm?: RecentGameStats[];
  marketValue: number;
  marketValueDisplay: string;
  age: number;
  rawGames?: CeapiGame[];
}

// --- Display vocabulary ---

/** Domestic league competition ID → display name */
export const LEAGUE_NAMES: Record<string, string> = {
  GB1: "Premier League",
  ES1: "LaLiga",
  L1: "Bundesliga",
  IT1: "Serie A",
  FR1: "Ligue 1",
  PO1: "Liga Portugal",
  NL1: "Eredivisie",
  BE1: "Jupiler Pro League",
  TR1: "Süper Lig",
  SA1: "Saudi Pro League",
  BRA1: "Série A",
  RU1: "Premier Liga",
  GR1: "Super League 1",
  DK1: "Superliga",
  MLS1: "MLS",
  GB2: "Championship",
  ES2: "LaLiga2",
  // Senior major-tournament names (see MAJOR_TOURNAMENTS) for recent-form rows.
  FIWC: "World Cup",
  EURO: "Euros",
  COPA: "Copa América",
  AFCN: "Africa Cup of Nations",
  AFAC: "Asian Cup",
  GOCU: "Gold Cup",
};

/** Transfermarkt CEAPI positionId → display name */
export const POSITION_NAMES: Record<number, string> = {
  1: "Goalkeeper",
  3: "Centre-Back",
  4: "Left-Back",
  5: "Right-Back",
  6: "Defensive Midfield",
  7: "Central Midfield",
  8: "Right Midfield",
  9: "Left Midfield",
  10: "Attacking Midfield",
  11: "Left Winger",
  12: "Right Winger",
  13: "Second Striker",
  14: "Centre-Forward",
};

// --- Season & competition rules ---

/** Date-based Transfermarkt season ID (e.g. 2025 = the 25/26 season). TM keys
 *  a season by its starting year and rolls over on Aug 1. This is only the
 *  *candidate* season: until the new season actually has games, the refresh
 *  script keeps aggregating the previous one (see lib/season-selection.ts),
 *  so never treat this value as "the season the data is for". */
export function tmCurrentSeasonId(): number {
  const now = new Date();
  const year = now.getFullYear();
  return now.getMonth() >= 7 ? year : year - 1;
}

/** Source: data/club-types.json (clubId → alpha-API clubTypeId) */
export type ClubTypes = Record<string, number>;

/** alpha-API `clubTypeId` for senior squads (national and club). Anything
 *  else (2=B, 3=U21, 4/6/8/9/10=youth variants, 5/7=non-senior NTs) is
 *  excluded from club aggregation. */
export const ALPHA_TYPE_SENIOR = 1;

/** CEAPI competition type IDs */
const COMP_TYPE_DOMESTIC_LEAGUE = 1;

/** competitionTypeIds that count as a top-flight goal for scorer-pool gating:
 *  1 = first-tier domestic league, 8 = domestic cup, 9 = domestic super cup,
 *  10 = continental/international club competition (UCL, Club World Cup, …),
 *  13 = continental super cup (UEFA Super Cup). Everything else — lower league
 *  tiers (2–7), league playoffs / minor comps (e.g. 12, 14), youth, national team —
 *  is discounted, so a tally scored in the 2nd/3rd division or playoffs doesn't read
 *  as a top-5 record. A whitelist (not a blacklist) so unknown lower-tier typeIds
 *  can't slip through. */
const TOP_FLIGHT_COMP_TYPES = new Set([COMP_TYPE_DOMESTIC_LEAGUE, 8, 9, 10, 13]);

/** competitionIds for the senior major-finals tournaments whose national-team
 *  stats count as "real tournament" play and are folded into totals by default.
 *  Friendlies (FS), all qualifiers (WMQ*, EMQ, AFCQ…), the Nations League
 *  (UNL*), and every youth/Olympic competition are deliberately excluded — only
 *  the marquee senior finals. FIWC = World Cup, EURO = Euros, COPA = Copa
 *  América, AFCN = Africa Cup of Nations, AFAC = AFC Asian Cup, GOCU = CONCACAF
 *  Gold Cup. A whitelist so friendlies/qualifiers can't pad a player's tally. */
const MAJOR_TOURNAMENTS = new Set(["FIWC", "EURO", "COPA", "AFCN", "AFAC", "GOCU"]);

/** True when this game belongs in the player's senior first-team aggregation.
 *  When clubTypeId isn't yet known (alpha API hasn't resolved it) we fall back
 *  to clubId equality so a freshly-encountered senior previous-club isn't
 *  dropped on first sight. */
function isFirstTeamGame(
  gameClubId: string | undefined,
  currentClubId: string,
  clubTypes: ClubTypes,
): boolean {
  if (!gameClubId) return false;
  const type = clubTypes[gameClubId];
  if (type !== undefined) return type === ALPHA_TYPE_SENIOR;
  return !!currentClubId && gameClubId === currentClubId;
}

/** States that count as "missed" (injury, suspension, absence — but not "not in squad") */
const MISSED_STATES = new Set(["injured", "absent", "suspended"]);

export interface AggregatedStats {
  goals: number;
  topFlightGoals: number;
  assists: number;
  minutes: number;
  appearances: number;
  penaltyGoals: number;
  penaltyMisses: number;
  intlGoals: number;
  intlAssists: number;
  intlMinutes: number;
  intlAppearances: number;
  intlPenaltyGoals: number;
  league: string;
  recentForm: RecentGameStats[];
  playedPosition: string;
  gamesMissed: number;
  totalGames: number;
  positionStats: {
    positionId: number;
    position: string;
    minutes: number;
    goals: number;
    assists: number;
    appearances: number;
  }[];
}

// Club aggregation only counts games played for any *senior first team*
// (clubTypeId === 1 in the alpha API). This drops B/U21/U18/youth-team
// appearances while preserving previous-club games for mid-season transfers
// (e.g. Semenyo's pre-Man-City Bournemouth minutes). Unresolved clubIds fall
// back to currentClubId equality so unseen-but-real senior teams aren't wiped.
export function aggregateSeasonStats(
  games: CeapiGame[],
  currentClubId: string,
  clubTypes: ClubTypes,
  seasonId: number,
): AggregatedStats {
  let goals = 0,
    topFlightGoals = 0,
    assists = 0,
    minutes = 0,
    appearances = 0,
    penaltyGoals = 0,
    penaltyMisses = 0;
  let intlGoals = 0,
    intlAssists = 0,
    intlMinutes = 0,
    intlAppearances = 0,
    intlPenaltyGoals = 0;
  let gamesMissed = 0;
  let totalGames = 0;
  let league = "";
  const recentGames: RecentGameStats[] = [];
  const byPos: Record<
    number,
    { minutes: number; goals: number; assists: number; appearances: number }
  > = {};
  // Record a played game into the position breakdown and the recent-form list.
  // Shared by club games and major-tournament national games so a World Cup
  // outing shows up in recent form and counts toward the position the player
  // lined up in — exactly like a club appearance.
  const recordPlayedGame = (
    g: CeapiGame,
    gls: number,
    ast: number,
    pGoals: number,
    mins: number,
    posId: number | null | undefined,
  ) => {
    if (posId) {
      const ps = (byPos[posId] ??= { minutes: 0, goals: 0, assists: 0, appearances: 0 });
      ps.minutes += mins;
      ps.goals += gls;
      ps.assists += ast;
      ps.appearances++;
    }
    recentGames.push({
      goals: gls,
      assists: ast,
      penaltyGoals: pGoals,
      minutes: mins,
      date: g.gameInformation.date?.dateTimeUTC?.slice(0, 10) ?? "",
      gameId: g.gameInformation.gameId,
      gameDay: g.gameInformation.gameDay,
      competitionId: g.gameInformation.competitionId,
      positionId: posId ?? undefined,
      competitionName: LEAGUE_NAMES[g.gameInformation.competitionId],
      venue: g.clubsInformation?.club?.venue,
      teamGoals: g.clubsInformation?.club?.goalsTotal ?? undefined,
      opponentGoals: g.clubsInformation?.club?.opponentGoalsTotal ?? undefined,
      opponentClubId: g.clubsInformation?.opponent?.clubId,
      matchReportUrl: g.gameInformation.gameId
        ? `${BASE_URL}/spielbericht/index/spielbericht/${g.gameInformation.gameId}`
        : undefined,
    });
  };
  for (const g of games) {
    if (g.gameInformation.seasonId !== seasonId) continue;
    const gs = g.statistics.goalStatistics;
    const mins = g.statistics.playingTimeStatistics.playedMinutes ?? 0;
    const state = g.statistics.generalStatistics.participationState ?? "";
    const posId = g.statistics.generalStatistics.positionId;
    const gls = gs.goalsScoredTotal ?? 0;
    const ast = gs.assists ?? 0;
    const pGoals = gs.penaltyShooterGoalsScored ?? 0;
    if (g.gameInformation.isNationalGame) {
      // Only senior major finals (World Cup, Euros, …) count — not friendlies,
      // qualifiers, the Nations League, or youth games. They feed the intl*
      // tallies and, when played, the recent-form list and position breakdown,
      // but never the club totals / availability below (so we `continue`).
      if (MAJOR_TOURNAMENTS.has(g.gameInformation.competitionId)) {
        intlGoals += gls;
        intlAssists += ast;
        intlPenaltyGoals += pGoals;
        intlMinutes += mins;
        if (mins > 0) {
          intlAppearances++;
          recordPlayedGame(g, gls, ast, pGoals, mins, posId);
        }
      }
      continue;
    }
    if (!isFirstTeamGame(g.clubsInformation?.club?.clubId, currentClubId, clubTypes)) continue;
    totalGames++;
    if (MISSED_STATES.has(state)) gamesMissed++;
    goals += gls;
    if (TOP_FLIGHT_COMP_TYPES.has(g.gameInformation.competitionTypeId)) topFlightGoals += gls;
    assists += ast;
    penaltyGoals += pGoals;
    penaltyMisses += gs.penaltyShooterMisses ?? 0;
    minutes += mins;
    if (mins > 0) {
      appearances++;
      recordPlayedGame(g, gls, ast, pGoals, mins, posId);
    }
    if (!league && g.gameInformation.competitionTypeId === COMP_TYPE_DOMESTIC_LEAGUE) {
      league = LEAGUE_NAMES[g.gameInformation.competitionId] ?? "";
    }
  }
  // ceapi returns games newest-first; sort to ensure that, then keep last 10
  recentGames.sort((a, b) => b.date.localeCompare(a.date));
  const recentForm = recentGames.slice(0, 10);
  const positionStats = Object.entries(byPos)
    .map(([id, ps]) => ({
      positionId: Number(id),
      position: POSITION_NAMES[Number(id)] ?? `Position ${id}`,
      ...ps,
    }))
    .sort((a, b) => b.minutes - a.minutes);
  const playedPosition = positionStats[0]?.position ?? "";
  return {
    goals,
    topFlightGoals,
    assists,
    minutes,
    appearances,
    penaltyGoals,
    penaltyMisses,
    intlGoals,
    intlAssists,
    intlMinutes,
    intlAppearances,
    intlPenaltyGoals,
    league,
    recentForm,
    playedPosition,
    gamesMissed,
    totalGames,
    positionStats,
  };
}

/** Re-aggregate season stats from already-fetched rawGames using an updated
 *  clubTypes map. Lets the refresh script enrich club types after the parallel
 *  fetch phase and then rebuild totals without re-hitting the network. */
export function reaggregatePlayerStats(
  prev: PlayerStatsResult,
  clubTypes: ClubTypes,
  seasonId: number,
): PlayerStatsResult {
  const games = prev.rawGames;
  if (!games?.length) return prev;
  const currentClubId = extractClubIdFromLogoUrl(prev.clubLogoUrl) ?? "";
  const stats = aggregateSeasonStats(games, currentClubId, clubTypes, seasonId);
  return { ...prev, ...stats };
}
