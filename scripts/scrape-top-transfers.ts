/**
 * Scrapes Transfermarkt's "Top transfers of the season" table — the N most
 * expensive moves of one season, each with the player's market value at the
 * time and the fee actually paid.
 *
 *   bun run scripts/scrape-top-transfers.ts [season] [limit]   # season defaults to current
 *   TM_FIXTURE_GLOB='tmp/transfers-plus1*.html' bun run scripts/scrape-top-transfers.ts
 *
 * `plus/1` is the wide variant of the view: it adds the "Left" club column that
 * the default `plus/0` omits, at no extra request cost.
 *
 * TM paginates this at 25 rows/page. Unlike the einnahmenausgaben endpoint (see
 * scrape-transfer-balance.ts), this one serves concurrent requests happily, so
 * every page goes at once through fetchPage's pool. Measured on the 8 pages of a
 * top-200 run: 2.1s all-at-once, against 2.2s for a single page — the whole
 * scrape costs what one request costs. (At concurrency 4 it was 4.1s, at 2 it
 * was 7.8s, so the pool's default of 10 is doing the work here.)
 *
 * TM does answer 503 to the odd page under that load. fetchPage retries with
 * backoff and they come good; one unlucky run took a minute rather than two
 * seconds, which is still the right trade against a guaranteed 45s of pauses.
 */
import { readFile, mkdir, writeFile } from "fs/promises";
import { readdirSync } from "fs";
import { dirname, join } from "path";
import * as cheerio from "cheerio";
import { fetchPage } from "@/lib/fetch";
import { parseMarketValue } from "@/lib/parse-market-value";
import { tmCurrentSeasonId } from "@/lib/player-aggregation";
import type { AnyNode } from "domhandler";
import type { TopTransfer, TransferClub } from "@/app/types";

const PAGE_SIZE = 25;

const pageUrl = (season: number, page: number) =>
  `https://www.transfermarkt.com/transfers/saisontransfers/statistik/top/plus/1/galerie/0${
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

/** Last numbered link in the pager; 1 when the table fits on a single page. */
export function lastPage(html: string): number {
  const nums = [...html.matchAll(/title="Page (\d+)"/g)].map((m) => Number(m[1]));
  return nums.length ? Math.max(...nums) : 1;
}

async function main() {
  // The transfer season rolls over with TM's own Aug 1 flip, so unlike the
  // stats refresh there is nothing to wait for — the new window's moves are
  // filed under the new ID immediately.
  const season = Number(process.argv[2] || tmCurrentSeasonId());
  const limit = Number(process.argv[3] ?? 200);
  const out = join(process.cwd(), "data", "top-transfers.json");
  const glob = process.env.TM_FIXTURE_GLOB;

  const all: TopTransfer[] = [];
  if (glob) {
    const dir = dirname(glob);
    const pattern = new RegExp(`^${glob.slice(dir.length + 1).replace(/\*/g, ".*")}$`);
    const files = readdirSync(dir)
      .filter((f) => pattern.test(f))
      .sort();
    for (const f of files) all.push(...parseTopTransfers(await readFile(join(dir, f), "utf-8")));
    console.log(`Fixtures ${files.join(", ")}: ${all.length} transfers`);
  } else {
    const pages = Math.ceil(limit / PAGE_SIZE);
    const started = Date.now();
    const perPage = await Promise.all(
      Array.from({ length: pages }, async (_, i) => {
        const rows = parseTopTransfers(await fetchPage(pageUrl(season, i + 1)));
        console.log(`page ${i + 1}/${pages}: ${rows.length} transfers`);
        return rows;
      }),
    );
    for (const rows of perPage) all.push(...rows);
    console.log(`${all.length} transfers in ${((Date.now() - started) / 1000).toFixed(1)}s`);

    // A short page in the middle means TM served a partial table, not the end of
    // the list — trimming to `limit` below would silently ship a gap.
    const short = perPage.findIndex((rows) => rows.length < PAGE_SIZE);
    if (short !== -1 && short < pages - 1) {
      throw new Error(`Page ${short + 1} returned ${perPage[short].length}/${PAGE_SIZE} rows`);
    }
  }

  if (!all.length) throw new Error("Parsed 0 transfers — selectors moved");
  const trimmed = all.sort((a, b) => a.rank - b.rank).slice(0, limit);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify({ season, transfers: trimmed }, null, 2));
  await writeFile(
    join(process.cwd(), "data", "top-transfers-updated-at.txt"),
    new Date().toISOString(),
  );
  console.log(`Wrote ${trimmed.length} transfers to ${out}`);
}

if (process.argv[1]?.endsWith("scrape-top-transfers.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
