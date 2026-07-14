import * as cheerio from "cheerio";
import { BASE_URL } from "@/lib/constants";
import { tmImage } from "./image";

/**
 * The identity every Transfermarkt player-listing row shares, parsed once from the
 * `.inline-table` player cell in column 0.
 */
export interface PlayerIdentity {
  name: string;
  playerId: string;
  profileUrl: string; // absolute
  imageUrl: string; // headshot at its largest size
  position: string;
}

/** Cheerio-free access to a row's cells, so callers never touch the DOM. */
export interface RowAccessor {
  /** Trimmed text of column `i`. */
  text(i: number): string;
  /** Largest-size URL of the first `<img>` in column `i` (data-src preferred), or "". */
  image(i: number): string;
  /** First `<a>` in column `i`, as `{ href, title }`. */
  link(i: number): { href: string; title: string };
}

const PLAYER_ID = /\/spieler\/(\d+)/;

function pickImage(img: cheerio.Cheerio<any>): string {
  return tmImage((img.attr("data-src") || img.attr("src") || "").trim());
}

function parsePlayerCell(
  $: cheerio.CheerioAPI,
  cells: cheerio.Cheerio<any>,
): PlayerIdentity | null {
  const inline = $(cells[0]).find(".inline-table");
  const link = inline.find(".hauptlink a").first();
  if (!link.length) return null; // header / spacer / non-player row
  const href = link.attr("href") || "";
  return {
    name: link.attr("title") || link.text().trim(),
    playerId: href.match(PLAYER_ID)?.[1] ?? "",
    profileUrl: href ? `${BASE_URL}${href}` : "",
    imageUrl: pickImage(inline.find("img").first()),
    position: inline.find("tr:last-child td").text().trim(),
  };
}

/**
 * Parse a Transfermarkt `table.items` player-listing page. The shared player
 * identity in column 0 is parsed once; the caller reads its page-specific columns
 * through a cheerio-free `RowAccessor` and returns its own row shape — or `null` to
 * drop the row. Rows without a player link (headers, spacers) are skipped.
 */
export function parsePlayerTable<T>(
  html: string,
  map: (player: PlayerIdentity, row: RowAccessor) => T | null,
): T[] {
  const $ = cheerio.load(html);
  const rows: T[] = [];
  $("table.items > tbody > tr").each((_, el) => {
    const cells = $(el).find("> td");
    const player = parsePlayerCell($, cells);
    if (!player) return;
    const row: RowAccessor = {
      text: (i) => $(cells[i]).text().trim(),
      image: (i) => pickImage($(cells[i]).find("img").first()),
      link: (i) => {
        const a = $(cells[i]).find("a").first();
        return { href: a.attr("href") || "", title: a.attr("title") || "" };
      },
    };
    const mapped = map(player, row);
    if (mapped != null) rows.push(mapped);
  });
  return rows;
}
