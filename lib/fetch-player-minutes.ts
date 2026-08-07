import { parseProfileHeader } from "@/lib/transfermarkt";
import { BASE_URL } from "./constants";
import { fetchPage, fetchJson } from "./fetch";
import { parseMarketValue } from "./parse-market-value";
import {
  aggregateSeasonStats,
  tmCurrentSeasonId,
  ALPHA_TYPE_SENIOR,
  type CeapiGame,
  type ClubTypes,
  type PlayerStatsResult,
} from "./player-aggregation";
import clubTypesData from "@/data/club-types.json";

/** Cross-source fetching for one player: leistungsdaten HTML (profile header),
 *  ceapi performance-game JSON (per-game stats), and the alpha API's senior
 *  national-career row — composed, reconciled, and aggregated through the pure
 *  `lib/player-aggregation` module. */

/** Static snapshot of data/club-types.json (clubId → alpha-API clubTypeId).
 *  The refresh script holds its own mutable copy when enriching new IDs. */
const STATIC_CLUB_TYPES = clubTypesData as Record<string, number>;
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

/** Raw fetch — no caching. Used by the offline refresh script. */
export async function fetchPlayerMinutesRaw(
  playerId: string,
  clubTypes: ClubTypes,
): Promise<PlayerStatsResult> {
  if (!playerId) return ZERO_STATS;

  // Fetch HTML (club/ribbon), ceapi (per-game stats), and the alpha-API senior
  // NT row in parallel. HTML + ceapi go through the shared TM concurrency
  // limiter; the alpha API runs on a different host and small payload, so it
  // stays a plain fetch.
  const [htmlContent, ceapi, seniorCareer] = await Promise.all([
    fetchPage(`${BASE_URL}/x/leistungsdaten/spieler/${playerId}`),
    fetchJson(`${BASE_URL}/ceapi/performance-game/${playerId}`) as Promise<{
      data?: { performance?: CeapiGame[] };
    }>,
    fetchSeniorCareer(playerId),
  ]);

  // The data-header (club, nationality, market value, caps, contract, age) is
  // parsed by the Transfermarkt module; only the cross-source work stays here.
  const header = parseProfileHeader(htmlContent);
  const marketValue = parseMarketValue(header.marketValueText);
  const marketValueDisplay = header.marketValueText || "-";

  const games: CeapiGame[] | undefined = ceapi?.data?.performance;
  // TM occasionally returns 200 with a nullish `performance` under rate pressure.
  // Treat that as a failure so the retry loop fires instead of silently caching zeros.
  if (!Array.isArray(games)) {
    throw new Error(`ceapi returned no performance array for ${playerId}`);
  }
  const stats = aggregateSeasonStats(games, header.clubId, clubTypes, tmCurrentSeasonId());

  // The alpha API is the canonical source for senior caps + whether the
  // player is in the current squad (the same data powers TM's green/yellow
  // shirt-number badge). Header values are kept as a fallback for API outages.
  const intlCareerCaps = seniorCareer?.caps ?? header.headerCaps;
  const isCurrentIntl = seniorCareer?.isCurrent ?? header.headerIsCurrentSenior;

  const shared = {
    club: header.club,
    clubLogoUrl: header.clubLogoUrl,
    intlCareerCaps,
    isCurrentIntl,
    isNewSigning: header.isNewSigning,
    isOnLoan: header.isOnLoan,
    contractExpiry: header.contractExpiry,
    nationality: header.nationality,
    nationalityFlagUrl: header.nationalityFlagUrl,
    leagueLogoUrl: header.leagueLogoUrl,
    marketValue,
    marketValueDisplay,
    age: header.age,
  };

  return { ...stats, ...shared, rawGames: games };
}
