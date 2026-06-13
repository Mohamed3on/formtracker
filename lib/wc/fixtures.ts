import { unstable_cache } from "next/cache";
import * as cheerio from "cheerio";
import { fetchPage } from "@/lib/fetch";
import { normName } from "./model";

// Same overall-schedule page used for standings/knockout, parsed here for the
// individual group fixtures: kickoff date/time, live score, and matchday.
const FIXTURES_URL =
  "https://www.transfermarkt.com/weltmeisterschaft/gesamtspielplan/pokalwettbewerb/FIWC/saison_id/2025";

export type GroupFixture = {
  group: string;
  matchday: number; // 1-3
  home: string; // roster name
  away: string;
  hs: number | null; // score once played
  as: number | null;
  played: boolean;
  kickoff: number; // sortable YYYYMMDDHHMM, in Transfermarkt's displayed zone (CEST)
  dow: string; // "Tue"
  dayLabel: string; // "16 Jun"
  timeLabel: string; // "9:00 PM"
};

const GROUPS = "ABCDEFGHIJKL".split("");
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "Tue 16/06/2026 9:00 PM" — the date/time header that precedes each fixture row.
const DT = /([A-Za-z]{3})\s+(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s?(AM|PM)/i;
type Kick = { kickoff: number; dow: string; dayLabel: string; timeLabel: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function teamIn(cell: cheerio.Cheerio<any>): string | null {
  const link = cell.find("a[href*='/verein/']").first();
  return link.length ? normName(link.text()) : null;
}

async function fetchFixtures(): Promise<GroupFixture[]> {
  const html = await fetchPage(FIXTURES_URL, 3600);
  const $ = cheerio.load(html);
  const out: GroupFixture[] = [];

  for (const g of GROUPS) {
    const box = $(".content-box-headline")
      .filter((_, el) => $(el).text().trim() === `Group ${g}`)
      .closest(".box");
    let cur: Kick | null = null;
    const gfix: GroupFixture[] = [];

    box.find("tr").each((_, tr) => {
      const tds = $(tr).find("td");
      const cells = tds.map((_, c) => $(c).text().trim().replace(/\s+/g, " ")).get();

      if (cells.length === 1) {
        const m = cells[0].match(DT);
        if (m) {
          let h = parseInt(m[5], 10);
          if (/PM/i.test(m[7]) && h !== 12) h += 12;
          if (/AM/i.test(m[7]) && h === 12) h = 0;
          cur = {
            kickoff: +`${m[4]}${m[3]}${m[2]}${String(h).padStart(2, "0")}${m[6]}`,
            dow: m[1],
            dayLabel: `${parseInt(m[2], 10)} ${MONTH[parseInt(m[3], 10) - 1]}`,
            timeLabel: `${m[5]}:${m[6]} ${m[7].toUpperCase()}`,
          };
        }
        return;
      }

      const c = cur;
      if (tds.length !== 6 || !c) return;
      const score = (cells[3] ?? "").match(/^(\d+):(\d+)$/);
      if (!score && cells[3] !== "-:-") return; // not a fixture row
      const home = teamIn(tds.eq(1));
      const away = teamIn(tds.eq(tds.length - 1));
      if (!home || !away) return;
      gfix.push({
        group: g,
        matchday: 0,
        home,
        away,
        hs: score ? parseInt(score[1], 10) : null,
        as: score ? parseInt(score[2], 10) : null,
        played: !!score,
        ...c,
      });
    });

    // 6 fixtures, 2 per matchday → sort by kickoff and chunk into pairs.
    gfix
      .sort((a, b) => a.kickoff - b.kickoff)
      .forEach((f, i) => (f.matchday = Math.floor(i / 2) + 1));
    out.push(...gfix);
  }
  return out;
}

/** Group-stage fixtures with live scores + matchday, refreshed hourly. */
export const getWcFixtures = unstable_cache(
  async (): Promise<GroupFixture[]> => {
    try {
      return await fetchFixtures();
    } catch (err) {
      console.error("[wc] failed to fetch group fixtures:", err);
      return [];
    }
  },
  ["wc-fixtures"],
  { revalidate: 3600, tags: ["wc-live"] },
);
