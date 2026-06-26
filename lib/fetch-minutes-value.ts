import * as cheerio from "cheerio";
import { readFile } from "fs/promises";
import { join } from "path";
import type { MinutesValuePlayer, PlayerStats } from "@/app/types";
import { BASE_URL } from "./constants";
import { fetchPage } from "./fetch";
import { parseMarketValue } from "./parse-market-value";
import { toPlayerStats, applyStatsToggles, includeTournamentStats } from "./stats-toggles";
export { toPlayerStats, applyStatsToggles, includeTournamentStats };

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
  clubMatches: 0,
  intlMatches: 0,
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

export async function getPlayerStatsData(): Promise<PlayerStats[]> {
  const players = await getMinutesValueData();
  return players.map(includeTournamentStats).map(toPlayerStats);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseMarketValueRow($: cheerio.CheerioAPI, row: any): Partial<MinutesValuePlayer> | null {
  const cells = $(row).find("> td");
  if (cells.length < 6) return null;

  const nameCell = $(cells[1]);
  const inlineTable = nameCell.find(".inline-table");
  const nameLink = inlineTable.find("td.hauptlink a");
  const name = nameLink.attr("title") || nameLink.text().trim();
  const profileUrl = nameLink.attr("href") || "";
  const position = inlineTable.find("tr").eq(1).find("td").text().trim();
  const imgEl = inlineTable.find("img").first();
  const imageUrl = (imgEl.attr("data-src") || imgEl.attr("src") || "").replace(
    "/small/",
    "/header/",
  );

  const playerIdMatch = profileUrl.match(/\/spieler\/(\d+)/);
  const playerId = playerIdMatch ? playerIdMatch[1] : "";

  const age = parseInt($(cells[2]).text().trim()) || 0;

  // Nationality from flag images
  const natCell = $(cells[3]);
  const natImg = natCell.find("img").first();
  const nationality = natImg.attr("title") || "";
  const nationalityFlagUrl =
    (natImg.attr("src") || "").replace(/\/(tiny|verysmall)\//, "/medium/") || "";

  const clubCell = $(cells[4]);
  const clubLink = clubCell.find("a").first();
  const club = clubLink.attr("title") || clubLink.find("img").attr("title") || "";
  const league = "";

  const mvDisplay = $(cells[5]).text().trim();
  const marketValue = parseMarketValue(mvDisplay);

  if (!name || !playerId) return null;
  return {
    name,
    position,
    age,
    club,
    league,
    nationality,
    nationalityFlagUrl,
    marketValue,
    marketValueDisplay: mvDisplay,
    imageUrl,
    profileUrl,
    playerId,
  };
}

/** Scrape market-value listing pages with a given query string. */
async function fetchMVPages(queryString: string, pages: number): Promise<MinutesValuePlayer[]> {
  const urls = Array.from({ length: pages }, (_, i) => {
    const base = `${MV_BASE}?ajax=yw1&${queryString}`;
    return i === 0 ? base : `${base}&page=${i + 1}`;
  });

  const results = await Promise.allSettled(urls.map((url) => fetchPage(url)));

  const mvMap = new Map<string, Partial<MinutesValuePlayer>>();
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const $ = cheerio.load(result.value);
    $("table.items > tbody > tr").each((_, row) => {
      const player = parseMarketValueRow($, row);
      if (player?.playerId) mvMap.set(player.playerId, player);
    });
  }

  const players: MinutesValuePlayer[] = [];
  for (const [playerId, mv] of mvMap) {
    players.push({
      ...EMPTY_PLAYER_STATS,
      ...mv,
      name: mv.name || "",
      position: mv.position || "",
      imageUrl: mv.imageUrl || "",
      profileUrl: mv.profileUrl || "",
      playerId,
    });
  }

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
