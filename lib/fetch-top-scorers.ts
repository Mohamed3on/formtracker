import { parsePlayerTable } from "@/lib/transfermarkt";
import type { MinutesValuePlayer } from "@/app/types";
import { BASE_URL } from "./constants";
import { fetchPage } from "./fetch";
import { EMPTY_PLAYER_STATS } from "./fetch-minutes-value";

function fetchPlayerList(
  urls: string[],
  label: string,
  extraHeaders?: Record<string, string>,
): Promise<MinutesValuePlayer[]> {
  return Promise.allSettled(urls.map((url) => fetchPage(url, undefined, extraHeaders))).then(
    (results) => {
      const players: MinutesValuePlayer[] = [];
      const seen = new Set<string>();

      for (const [index, result] of results.entries()) {
        if (result.status !== "fulfilled") {
          console.error(`[${label}] Failed to fetch ${urls[index]}:`, result.reason);
          continue;
        }
        const pageRows = parsePlayerTable(
          result.value,
          (player) => {
            if (!player.name || !player.playerId || seen.has(player.playerId)) return null;
            seen.add(player.playerId);
            return {
              ...EMPTY_PLAYER_STATS,
              name: player.name,
              position: player.position,
              imageUrl: player.imageUrl,
              profileUrl: player.profileUrl,
              playerId: player.playerId,
            };
          },
          { playerColumn: 1 },
        );
        players.push(...pageRows);
      }

      return players;
    },
  );
}

function paginateUrls(baseUrl: string, pages: number): string[] {
  return Array.from({ length: pages }, (_, i) => {
    const page = i + 1;
    return page === 1 ? `${baseUrl}?ajax=yw1` : `${baseUrl}/page/${page}?ajax=yw1`;
  });
}

/** Season top scorers (10 pages, ~250 players). */
export function fetchTopScorersRaw(): Promise<MinutesValuePlayer[]> {
  const baseUrl = `${BASE_URL}/scorer/topscorer/statistik/2024/saison_id/2025/selectedOptionKey/6/land_id/0/altersklasse//ausrichtung//spielerposition_id//filter/0/yt0/Show/plus/1/galerie/0`;
  return fetchPlayerList(paginateUrls(baseUrl, 10), "topScorers");
}

/** Yearly top scorers (5 pages, ~125 players). Uses current year. */
export function fetchYearlyScorersRaw(): Promise<MinutesValuePlayer[]> {
  const year = new Date().getFullYear();
  const basePath = `${BASE_URL}/spieler-statistik/jahrestorschuetzen/statistik/stat/ajax/yw1/jahr/${year}/selectedOptionKey/6/monatVon/01/monatBis/12/altersklasse//land_id//ausrichtung/alle/spielerposition_id/alle/art/2/plus/1/galerie/0`;
  const referer = `${BASE_URL}/spieler-statistik/jahrestorschuetzen/statistik/stat/plus/1/galerie/0?jahr=${year}&selectedOptionKey=6&monatVon=01&monatBis=12&altersklasse=&land_id=&ausrichtung=alle&spielerposition_id=alle&art=2`;
  return fetchPlayerList(paginateUrls(basePath, 5), "yearlyScorers", {
    "X-Requested-With": "XMLHttpRequest",
    Referer: referer,
    Accept: "*/*",
  });
}
