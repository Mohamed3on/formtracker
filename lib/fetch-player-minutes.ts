import * as cheerio from "cheerio";
import type { CeapiGame, PlayerStatsResult, RecentGameStats } from "@/app/types";
import { BASE_URL } from "./constants";
import { fetchPage, withSlot } from "./fetch";
import { proxyInit } from "./proxy";
import { parseMarketValue } from "./parse-market-value";
import { extractClubIdFromLogoUrl } from "./format";
import clubTypesData from "@/data/club-types.json";

/** Static snapshot of data/club-types.json (clubId → alpha-API clubTypeId).
 *  The refresh script holds its own mutable copy when enriching new IDs. */
const STATIC_CLUB_TYPES = clubTypesData as Record<string, number>;
/** alpha-API `clubTypeId` for senior squads (national and club). Anything
 *  else (2=B, 3=U21, 4/6/8/9/10=youth variants, 5/7=non-senior NTs) is
 *  excluded from club aggregation. */
const ALPHA_TYPE_SENIOR = 1;
const TM_API_BASE = "https://tmapi-alpha.transfermarkt.technology";

interface NationalCareerEntry {
  clubId: string;
  gamesPlayed: number;
  careerState: string;
}

/**
 * Fetches the canonical senior NT line from the same API that powers
 * Transfermarkt's player widget. Returns null on any network/parse error so
 * callers can fall back to header / ceapi-derived values.
 */
async function fetchSeniorCareer(
  playerId: string,
): Promise<{ caps: number; isCurrent: boolean } | null> {
  try {
    const r = await fetch(`${TM_API_BASE}/player/${playerId}/national-career-history`, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { data?: { history?: NationalCareerEntry[] } };
    const senior = j?.data?.history?.find(
      (h) => !!h.clubId && STATIC_CLUB_TYPES[h.clubId] === ALPHA_TYPE_SENIOR,
    );
    if (!senior) return null;
    return {
      caps: senior.gamesPlayed ?? 0,
      isCurrent: senior.careerState === "CURRENT_NATIONAL_PLAYER",
    };
  } catch {
    return null;
  }
}

const ZERO_STATS: PlayerStatsResult = {
  minutes: 0,
  appearances: 0,
  goals: 0,
  topFlightGoals: 0,
  assists: 0,
  penaltyGoals: 0,
  penaltyMisses: 0,
  intlGoals: 0,
  intlAssists: 0,
  intlMinutes: 0,
  intlAppearances: 0,
  intlPenaltyGoals: 0,
  intlCareerCaps: 0,
  isCurrentIntl: false,
  club: "",
  clubLogoUrl: "",
  league: "",
  isNewSigning: false,
  isOnLoan: false,
  playedPosition: "",
  contractExpiry: undefined,
  gamesMissed: 0,
  totalGames: 0,
  positionStats: [],
  marketValue: 0,
  marketValueDisplay: "-",
  age: 0,
};

const CEAPI_BASE_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  Accept: "application/json",
};

function getCeapiHeaders(): Record<string, string> {
  return process.env.TM_COOKIE
    ? { ...CEAPI_BASE_HEADERS, Cookie: process.env.TM_COOKIE }
    : CEAPI_BASE_HEADERS;
}

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

/** Current Transfermarkt season ID (e.g. 2025 = the 25/26 season). */
function currentSeasonId(): number {
  const now = new Date();
  const year = now.getFullYear();
  return now.getMonth() >= 7 ? year : year - 1;
}

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

interface AggregatedStats {
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

/** Source: data/club-types.json */
export type ClubTypes = Record<string, number>;

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

// Club aggregation only counts games played for any *senior first team*
// (clubTypeId === 1 in the alpha API). This drops B/U21/U18/youth-team
// appearances while preserving previous-club games for mid-season transfers
// (e.g. Semenyo's pre-Man-City Bournemouth minutes). Unresolved clubIds fall
// back to currentClubId equality so unseen-but-real senior teams aren't wiped.
function aggregateSeasonStats(
  games: CeapiGame[],
  currentClubId: string,
  clubTypes: ClubTypes,
): AggregatedStats {
  const seasonId = currentSeasonId();
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
): PlayerStatsResult {
  const games = prev.rawGames;
  if (!games?.length) return prev;
  const currentClubId = extractClubIdFromLogoUrl(prev.clubLogoUrl) ?? "";
  const stats = aggregateSeasonStats(games, currentClubId, clubTypes);
  return { ...prev, ...stats };
}

/** Raw fetch — no caching. Used by the offline refresh script. */
export async function fetchPlayerMinutesRaw(
  playerId: string,
  clubTypes: ClubTypes,
): Promise<PlayerStatsResult> {
  if (!playerId) return ZERO_STATS;

  // Fetch HTML (club/ribbon), ceapi (per-game stats), and the alpha-API senior
  // NT row in parallel. HTML + ceapi go through the shared TM concurrency
  // limiter; the alpha API runs on a different host and small payload, so we
  // don't slot it.
  const [htmlContent, ceapiRes, seniorCareer] = await Promise.all([
    fetchPage(`${BASE_URL}/x/leistungsdaten/spieler/${playerId}`),
    withSlot(() =>
      fetch(`${BASE_URL}/ceapi/performance-game/${playerId}`, {
        headers: getCeapiHeaders(),
        cache: "no-store",
        ...proxyInit(),
      }),
    ),
    fetchSeniorCareer(playerId),
  ]);

  // Parse club/ribbon from HTML
  const $ = cheerio.load(htmlContent);
  const clubInfo = $(".data-header__club-info");
  const club = clubInfo.find(".data-header__club a").text().trim();
  const clubAnchor = $(".data-header__box__club-link").first();
  const clubLogoImg = clubAnchor.find("img").first();
  const clubLogoSrcset = (clubLogoImg.attr("srcset") || "").trim();
  const clubLogoUrl = clubLogoSrcset.split(/\s+/)[0] || clubLogoImg.attr("src") || "";
  // Current first-team clubId. Used to drop B-team / youth / previous-club
  // appearances from season aggregation in aggregateSeasonStats.
  const currentClubId = (clubAnchor.attr("href") || "").match(/\/verein\/(\d+)/)?.[1] ?? "";
  const ribbonText = $(".data-header__ribbon span").text().trim().toLowerCase();
  const isOnLoan = ribbonText === "on loan";
  const isNewSigning = ribbonText === "new arrival" || ribbonText === "winter signing" || isOnLoan;

  // Nationality from profile header
  const natFlagImg = $("span[itemprop='nationality'] img.flaggenrahmen").first();
  const nationalityFlagUrl =
    (natFlagImg.attr("src") || "").replace(/\/(tiny|verysmall)\//, "/medium/") || "";
  const nationality = natFlagImg.attr("title") || "";

  // League logo URL from profile header
  const leagueLinkImg = $(".data-header__league-link img").first();
  const leagueLogoUrl =
    (leagueLinkImg.attr("src") || "").replace(/\/(verytiny|tiny)\//, "/header/") || "";

  // Parse senior international caps from profile header (Caps/Goals: N).
  // The header only shows the player's *current* national team, so it
  // under-reports for youth-squad players. Treated here as a fallback for when
  // the alpha API is unreachable; the API result takes precedence below.
  const capsLi = $("li:contains('Caps/Goals')").first();
  const capsUl = capsLi.closest("ul");
  const natTeamName = capsUl.find("a[href*='/startseite/verein/']").first().attr("title") || "";
  const headerIsSenior = !!natTeamName && !/U\d/i.test(natTeamName);
  const headerCaps = headerIsSenior ? parseInt(capsLi.find("a").first().text().trim()) || 0 : 0;
  const ntLabel = capsUl.find(".data-header__label").first().text().trim().toLowerCase();
  const headerCurrentIntl = headerIsSenior && ntLabel.includes("current international");

  // Parse contract expiry from club info header
  const contractLabel = clubInfo.find(".data-header__label:contains('Contract expires:')");
  const contractExpiry = contractLabel.find(".data-header__content").text().trim() || undefined;

  // Parse market value from profile header
  const mvEl = $(".data-header__market-value-wrapper");
  const mvText = mvEl.clone().children("p").remove().end().text().trim();
  const marketValue = parseMarketValue(mvText);
  const marketValueDisplay = mvText || "-";

  // Parse age from birth date
  const birthText = $("span[itemprop='birthDate']").text().trim();
  const ageMatch = birthText.match(/\((\d+)\)/);
  const age = ageMatch ? parseInt(ageMatch[1]) : 0;

  if (!ceapiRes.ok) {
    throw new Error(`ceapi ${ceapiRes.status} for ${playerId}`);
  }
  const ceapi = await ceapiRes.json();
  const games: CeapiGame[] | undefined = ceapi?.data?.performance;
  // TM occasionally returns 200 with a nullish `performance` under rate pressure.
  // Treat that as a failure so the retry loop fires instead of silently caching zeros.
  if (!Array.isArray(games)) {
    throw new Error(`ceapi returned no performance array for ${playerId}`);
  }
  const stats = aggregateSeasonStats(games, currentClubId, clubTypes);

  // The alpha API is the canonical source for senior caps + whether the
  // player is in the current squad (the same data powers TM's green/yellow
  // shirt-number badge). Header values are kept as a fallback for API outages.
  const intlCareerCaps = seniorCareer?.caps ?? headerCaps;
  const isCurrentIntl = seniorCareer?.isCurrent ?? headerCurrentIntl;

  const shared = {
    club,
    clubLogoUrl,
    intlCareerCaps,
    isCurrentIntl,
    isNewSigning,
    isOnLoan,
    contractExpiry,
    nationality,
    nationalityFlagUrl,
    leagueLogoUrl,
    marketValue,
    marketValueDisplay,
    age,
  };

  return { ...stats, ...shared, rawGames: games };
}
