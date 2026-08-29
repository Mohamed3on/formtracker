import { parsePlayerTable } from "@/lib/transfermarkt";
import type { TopTransfer } from "@/app/types";
import { BASE_URL } from "./constants";
import { fetchPage } from "./fetch";
import { parseMarketValue } from "./parse-market-value";
import { tmCurrentSeasonId } from "./player-aggregation";

/**
 * Transfermarkt's "Top transfers of the season" table — the N most expensive
 * moves of one season, each with the player's market value at the time and the
 * fee actually paid.
 *
 * `plus/1` is the wide variant of the view: it adds the "Left" club column the
 * default `plus/0` omits, at no extra request cost.
 *
 * TM paginates this at 25 rows/page. Unlike the einnahmenausgaben endpoint (see
 * scripts/scrape-transfer-balance.ts), this one serves concurrent requests
 * happily, so every page goes at once through fetchPage's pool. Measured on the
 * 8 pages of a top-200 fetch: 2.1s all-at-once against 2.2s for a single page —
 * the whole thing costs what one request costs. (At concurrency 4 it was 4.1s,
 * at 2 it was 7.8s, so the pool's default of 10 is doing the work.) TM does
 * answer 503 to the odd page under that load; fetchPage retries with backoff.
 */
const PAGE_SIZE = 25;
export const TOP_TRANSFER_LIMIT = 200;

/** Column layout of the `plus/1` view. The player mini-table is column 1; the
 *  rest are read positionally off the row accessor. */
const COL = {
  rank: 0,
  age: 2,
  marketValue: 3,
  nationality: 4,
  from: 5,
  to: 6,
  fee: 7,
} as const;

const pageUrl = (season: number, page: number) =>
  `${BASE_URL}/transfers/saisontransfers/statistik/top/plus/1/galerie/0${
    page > 1 ? `/page/${page}` : ""
  }?saison_id=${season}&transferfenster=alle&land_id=&ausrichtung=&spielerposition_id=&altersklasse=&leihe=&art=`;

export function parseTopTransfers(html: string): TopTransfer[] {
  return parsePlayerTable(
    html,
    (player, row) => {
      if (!player.playerId || !player.name) return null;

      // The fee cell carries the transfer type in its text for non-purchases
      // ("loan transfer", "End of loan", "free transfer"). Only a plain money
      // figure is a fee we can compare against a market value.
      const feeText = row.text(COL.fee);

      return {
        rank: Number(row.text(COL.rank)) || 0,
        playerId: player.playerId,
        name: player.name,
        position: player.position,
        age: Number(row.text(COL.age)) || 0,
        imageUrl: player.imageUrl,
        // TM lists both passports of a dual national; the first is the one it
        // sorts and filters him under.
        nationality: row.imageTitle(COL.nationality),
        nationalityFlagUrl: row.image(COL.nationality),
        marketValue: parseMarketValue(row.text(COL.marketValue)),
        fee: parseMarketValue(feeText),
        feeText,
        isLoan: /loan/i.test(feeText),
        from: row.club(COL.from),
        to: row.club(COL.to),
      };
    },
    { playerColumn: 1 },
  );
}

/** The transfer season rolls over with TM's own Aug 1 flip, so unlike the stats
 *  refresh there is nothing to wait for — the new window's moves are filed under
 *  the new ID immediately. */
export async function fetchTopTransfers(
  limit = TOP_TRANSFER_LIMIT,
  season = tmCurrentSeasonId(),
): Promise<{ season: number; transfers: TopTransfer[] }> {
  const pages = Math.ceil(limit / PAGE_SIZE);
  const results = await Promise.allSettled(
    Array.from({ length: pages }, (_, i) => fetchPage(pageUrl(season, i + 1))),
  );

  // Every page has to land. A partial set is not a shorter list — a failed page
  // in the middle punches a 25-row hole through the rankings, the club totals
  // and the season aggregate alike, and unstable_cache would then serve that
  // hole for a day while the page still called itself the season's biggest 200.
  // Failing here keeps the last good cache entry instead.
  const transfers: TopTransfer[] = [];
  for (const [i, result] of results.entries()) {
    if (result.status !== "fulfilled") {
      throw new Error(`[top-transfers] page ${i + 1} of ${pages} failed: ${result.reason}`);
    }
    const rows = parseTopTransfers(result.value);
    // TM fills every page but the last. A short one earlier in the run means the
    // selectors moved, or the WAF served an empty 200 that fetchPage can't tell
    // from a real answer — either way it isn't a shorter season.
    if (rows.length < PAGE_SIZE && i < pages - 1) {
      throw new Error(
        `[top-transfers] page ${i + 1} of ${pages} parsed ${rows.length}/${PAGE_SIZE} rows — selectors moved or TM is blocking`,
      );
    }
    transfers.push(...rows);
  }

  if (!transfers.length) throw new Error("Parsed 0 transfers — selectors moved or TM is blocking");

  // TM's own rank column is the fee order across the whole season.
  transfers.sort((a, b) => a.rank - b.rank);
  return { season, transfers: transfers.slice(0, limit) };
}
