import { parsePlayerTable } from "@/lib/transfermarkt";
import { readFile } from "fs/promises";
import { join } from "path";
import type { MinutesValuePlayer } from "@/app/types";
import { BASE_URL } from "./constants";
import { fetchPage } from "./fetch";
import { parseMarketValue } from "./parse-market-value";
export { toPlayerStats, applyStatsToggles, includeTournamentStats } from "./stats-toggles";

const MV_BASE = `${BASE_URL}/spieler-statistik/wertvollstespieler/marktwertetop`;

export const EMPTY_PLAYER_STATS: Omit<
  MinutesValuePlayer,
  "name" | "position" | "imageUrl" | "profileUrl" | "playerId"
> = {
  age: 0,
  club: "",
  clubLogoUrl: "",
  league: "",
  nationality: "",
  nationalityFlagUrl: "",
  marketValue: 0,
  marketValueDisplay: "-",
  minutes: 0,
  totalMatches: 0,
  goals: 0,
  assists: 0,
  penaltyGoals: 0,
  penaltyMisses: 0,
  intlGoals: 0,
  intlAssists: 0,
  intlMinutes: 0,
  intlAppearances: 0,
  intlPenaltyGoals: 0,
  intlCareerCaps: 0,
};

function parseMarketValueRows(html: string): MinutesValuePlayer[] {
  return parsePlayerTable<MinutesValuePlayer>(
    html,
    (player, row) => {
      if (!player.name || !player.playerId) return null;
      const mvDisplay = row.text(5);
      return {
        ...EMPTY_PLAYER_STATS,
        name: player.name,
        position: player.position,
        age: parseInt(row.text(2)) || 0,
        club: row.link(4).title || row.imageTitle(4),
        nationality: row.imageTitle(3),
        nationalityFlagUrl: row.image(3),
        marketValue: parseMarketValue(mvDisplay),
        marketValueDisplay: mvDisplay,
        imageUrl: player.imageUrl,
        profileUrl: player.profileUrl,
        playerId: player.playerId,
      };
    },
    { playerColumn: 1 },
  );
}

/** Scrape market-value listing pages with a given query string. */
async function fetchMVPages(queryString: string, pages: number): Promise<MinutesValuePlayer[]> {
  const urls = Array.from({ length: pages }, (_, i) => {
    const base = `${MV_BASE}?ajax=yw1&${queryString}`;
    return i === 0 ? base : `${base}&page=${i + 1}`;
  });

  const results = await Promise.allSettled(urls.map((url) => fetchPage(url)));

  const mvMap = new Map<string, MinutesValuePlayer>();
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const player of parseMarketValueRows(result.value)) {
      mvMap.set(player.playerId, player);
    }
  }

  const players = [...mvMap.values()];
  players.sort((a, b) => b.marketValue - a.marketValue);
  return players;
}

export const fetchMinutesValueRaw = () =>
  fetchMVPages("altersklasse=alle&ausrichtung=alle&land_id=0&yt0=Show", 20);

export const fetchO30MostValuableRaw = () =>
  fetchMVPages(
    "altersklasse=o30&ausrichtung=alle&spielerposition_id=alle&land_id=0&kontinent_id=0&jahrgang=0&jahr=0&yt0=Show",
    3,
  );

export const fetchTopForwardsRaw = () =>
  fetchMVPages(
    "ausrichtung=Sturm&spielerposition_id=alle&altersklasse=alle&jahrgang=0&land_id=0&kontinent_id=0&jahr=0&yt0=Show",
    10,
  );

/** Reads pre-built JSON data committed to the repo. */
export async function getMinutesValueData(): Promise<MinutesValuePlayer[]> {
  const filePath = join(process.cwd(), "data", "minutes-value.json");
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as MinutesValuePlayer[];
}

/**
 * Strip heavy fields before serializing to client components.
 * - `recentForm`: 3.3MB (78% of full payload). Pass `trimRecentForm: true` to
 *   keep only the 4 fields the client actually reads (goals, assists, penaltyGoals, minutes).
 * - `positionStats`: 210KB, unused by any client component.
 */
export function slimForClient(
  players: MinutesValuePlayer[],
  opts?: { trimRecentForm?: boolean },
): MinutesValuePlayer[] {
  return players.map(({ positionStats: _positionStats, recentForm, ...rest }) => ({
    ...rest,
    ...(opts?.trimRecentForm && recentForm
      ? {
          recentForm: recentForm.map(({ goals, assists, penaltyGoals, minutes }) => ({
            goals,
            assists,
            penaltyGoals,
            minutes,
          })) as typeof recentForm,
        }
      : {}),
  }));
}
