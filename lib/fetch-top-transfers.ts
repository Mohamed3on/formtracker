import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { BASE_URL } from "./constants";
import { fetchPage } from "./fetch";
import { parseMarketValue } from "./parse-market-value";
import { tmCurrentSeasonId } from "./player-aggregation";
import type { TopTransfer, TransferClub } from "@/app/types";

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

const pageUrl = (season: number, page: number) =>
  `${BASE_URL}/transfers/saisontransfers/statistik/top/plus/1/galerie/0${
    page > 1 ? `/page/${page}` : ""
  }?saison_id=${season}&transferfenster=alle&land_id=&ausrichtung=&spielerposition_id=&altersklasse=&leihe=&art=`;

/** A club cell is a nested inline-table: crest link on the left, club name in
 *  `.hauptlink`, competition link underneath. Both "Left" and "Joined" use it. */
function parseClub(cell: cheerio.Cheerio<AnyNode>): TransferClub {
  const clubLink = cell.find("td.hauptlink a").first();
  return {
    name: clubLink.text().trim(),
    clubId: clubLink.attr("href")?.match(/\/verein\/(\d+)/)?.[1] ?? "",
    logoUrl: cell.find("img.tiny_wappen").first().attr("src") ?? "",
    league: cell.find("a[href*='/wettbewerb/']").last().text().trim(),
    country: cell.find("img.flaggenrahmen").last().attr("title") ?? "",
  };
}

export function parseTopTransfers(html: string): TopTransfer[] {
  const $ = cheerio.load(html);
  const out: TopTransfer[] = [];

  $("table.items > tbody > tr").each((_, tr) => {
    const td = $(tr).find("> td");
    if (td.length < 8) return;

    const playerLink = td.eq(1).find("a[href*='/profil/spieler/']").first();
    const playerId = playerLink.attr("href")?.match(/\/spieler\/(\d+)/)?.[1] ?? "";
    const name = playerLink.text().trim();
    if (!playerId || !name) return;

    // The fee cell carries the transfer type in its text for non-purchases
    // ("loan transfer", "End of loan", "free transfer"). Only a plain money
    // figure is a fee we can compare against a market value.
    const feeText = td.eq(7).text().trim();
    const fee = parseMarketValue(feeText);
    const marketValue = parseMarketValue(td.eq(3).text().trim());

    out.push({
      rank: Number(td.eq(0).text().trim()) || out.length + 1,
      playerId,
      name,
      // The second row of the player inline-table is the position.
      position: td.eq(1).find("table.inline-table tr").eq(1).find("td").first().text().trim(),
      age: Number(td.eq(2).text().trim()) || 0,
      imageUrl: td.eq(1).find("img.bilderrahmen-fixed").first().attr("data-src") ?? "",
      nationality: td.eq(4).find("img.flaggenrahmen").first().attr("title") ?? "",
      nationalityFlagUrl: td.eq(4).find("img.flaggenrahmen").first().attr("src") ?? "",
      marketValue,
      fee,
      feeText,
      isLoan: /loan/i.test(feeText),
      from: parseClub(td.eq(5)),
      to: parseClub(td.eq(6)),
    });
  });

  return out;
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

  const transfers: TopTransfer[] = [];
  for (const [i, result] of results.entries()) {
    if (result.status !== "fulfilled") {
      // One page short beats no page at all: the lists stay useful, they just
      // stop 25 rows sooner. Every page failing is a real break and throws below.
      console.error(`[top-transfers] page ${i + 1} failed:`, result.reason);
      continue;
    }
    transfers.push(...parseTopTransfers(result.value));
  }

  if (!transfers.length) throw new Error("Parsed 0 transfers — selectors moved or TM is blocking");

  transfers.sort((a, b) => a.rank - b.rank);
  return { season, transfers: transfers.slice(0, limit) };
}
