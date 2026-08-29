import * as cheerio from "cheerio";
import { tmImage } from "./image";

/**
 * The identity every Transfermarkt player-listing row shares, parsed once from the
 * `.inline-table` player cell.
 */
export interface PlayerIdentity {
  name: string;
  playerId: string;
  profileUrl: string; // relative href, as served by Transfermarkt
  imageUrl: string; // headshot at its largest size
  position: string;
}

/**
 * The club named by a listing row, parsed from the `.inline-table` club cell —
 * the crest/name/competition mini-table Transfermarkt reuses wherever a row
 * names a club (the transfer table's "Left" and "Joined" columns are two of it).
 */
export interface ClubIdentity {
  /** TM's own display form — "Man City", "PSG", "Nott'm Forest". The full name
   *  ("Manchester City") is the crest link's title, via `link(i).title`. */
  name: string;
  clubId: string;
  logoUrl: string;
  league: string;
  /** Nation of the club's competition, off the flag beside it. */
  country: string;
}

/** Cheerio-free access to a row's cells, so callers never touch the DOM. */
export interface RowAccessor {
  /** Trimmed text of column `i`. */
  text(i: number): string;
  /** Largest-size URL of the first image in column `i` (data-src preferred), or "". */
  image(i: number): string;
  /** `title` of the first image in column `i` (e.g. a flag's nation), or "". */
  imageTitle(i: number): string;
  /** First link in column `i`, as `{ href, title }`. */
  link(i: number): { href: string; title: string };
  /** The club named in column `i`. Every field is "" on a cell TM left blank —
   *  a released player has no club on the way in. */
  club(i: number): ClubIdentity;
  /** Escape hatch: an attribute off the first `selector` match in column `i`, for
   *  bespoke cells the typed accessors don't cover. Prefer text/image/link/imageTitle. */
  attr(i: number, selector: string, name: string): string;
}

const PLAYER_ID = /\/spieler\/(\d+)/;
const CLUB_ID = /\/verein\/(\d+)/;

function pickImage(img: cheerio.Cheerio<any>): string {
  return tmImage((img.attr("data-src") || img.attr("src") || "").trim());
}

function parsePlayerCell(cell: cheerio.Cheerio<any>): PlayerIdentity | null {
  const inline = cell.find(".inline-table");
  const link = inline.find(".hauptlink a").first();
  if (!link.length) return null; // header / spacer / non-player row
  const href = link.attr("href") || "";
  return {
    name: link.attr("title") || link.text().trim(),
    playerId: href.match(PLAYER_ID)?.[1] ?? "",
    profileUrl: href,
    imageUrl: pickImage(inline.find("img").first()),
    position: inline.find("tr:last-child td").text().trim(),
  };
}

function parseClubCell(cell: cheerio.Cheerio<any>): ClubIdentity {
  const link = cell.find("td.hauptlink a").first();
  const href = link.attr("href") || "";
  return {
    name: link.text().trim() || link.attr("title") || "",
    clubId: href.match(CLUB_ID)?.[1] ?? "",
    logoUrl: pickImage(cell.find("img.tiny_wappen").first()),
    // The competition sits on the mini-table's second row, with its nation's flag
    // beside it; `last()` skips the crest link above it.
    league: cell.find("a[href*='/wettbewerb/']").last().text().trim(),
    country: cell.find("img.flaggenrahmen").last().attr("title") || "",
  };
}

/**
 * Parse a Transfermarkt `table.items` player-listing page. The shared player
 * identity is parsed once from the player cell (column `playerColumn`, default 0);
 * the caller reads its page-specific columns through a cheerio-free `RowAccessor`
 * and returns its own row shape — or `null` to drop the row. Rows without a player
 * link (headers, spacers) are skipped.
 */
export function parsePlayerTable<T>(
  html: string,
  map: (player: PlayerIdentity, row: RowAccessor) => T | null,
  opts: { playerColumn?: number } = {},
): T[] {
  const playerColumn = opts.playerColumn ?? 0;
  const $ = cheerio.load(html);
  const rows: T[] = [];
  $("table.items > tbody > tr").each((_, el) => {
    const cells = $(el).find("> td");
    const player = parsePlayerCell($(cells[playerColumn]));
    if (!player) return;
    const img = (i: number) => $(cells[i]).find("img").first();
    const row: RowAccessor = {
      text: (i) => $(cells[i]).text().trim(),
      image: (i) => pickImage(img(i)),
      imageTitle: (i) => img(i).attr("title") || "",
      link: (i) => {
        const a = $(cells[i]).find("a").first();
        return { href: a.attr("href") || "", title: a.attr("title") || "" };
      },
      club: (i) => parseClubCell($(cells[i])),
      attr: (i, selector, name) => $(cells[i]).find(selector).first().attr(name) || "",
    };
    const mapped = map(player, row);
    if (mapped != null) rows.push(mapped);
  });
  return rows;
}
