import { unstable_cache } from "next/cache";
import * as cheerio from "cheerio";
import { fetchPage } from "@/lib/fetch";
import { normName, type Round } from "./model";

const FIXTURES_URL =
  "https://www.transfermarkt.com/weltmeisterschaft/gesamtspielplan/pokalwettbewerb/FIWC/saison_id/2025";

export type GroupStanding = {
  name: string;
  rank: number;
  played: number;
  gd: number;
  goals: string;
  pts: number;
};
export type GroupData = { rows: GroupStanding[]; complete: boolean; anyPlayed: boolean };
export type KoMatch = {
  round: Round;
  num: number;
  home: string | null; // normalized real team name, or null while it's a placeholder
  away: string | null;
  hs: number | null; // scores once played
  as: number | null;
};
export type WcResults = {
  started: boolean;
  fetchedAt: number;
  groups: Record<string, GroupData>;
  ko: KoMatch[];
};

const GROUPS = "ABCDEFGHIJKL".split("");
const EMPTY: WcResults = { started: false, fetchedAt: 0, groups: {}, ko: [] };

const intIn = (s: string): number | null => {
  const m = s.match(/-?\d+/);
  return m ? parseInt(m[0], 10) : null;
};

function parseLabel(label: string): { round: Round; num: number } | null {
  const s = label.trim();
  if (/3rd/i.test(s)) return null; // third-place play-off — not part of the bracket tree
  const m = s.match(/^(Ro32|Ro16|QF|SF|FI)\s*(\d+)?/i);
  if (!m) return null;
  const n = m[2] ? parseInt(m[2], 10) : 1;
  const tag = m[1].toUpperCase();
  if (tag === "RO32") return { round: "R32", num: n };
  if (tag === "RO16") return { round: "R16", num: n };
  if (tag === "QF") return { round: "QF", num: n };
  if (tag === "SF") return { round: "SF", num: n };
  return { round: "F", num: 1 }; // FI
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function teamIn(cell: cheerio.Cheerio<any>): string | null {
  const link = cell.find("a[href*='/verein/']").first();
  return link.length ? normName(link.text()) : null;
}

async function fetchResults(): Promise<WcResults> {
  const html = await fetchPage(FIXTURES_URL, 3600);
  const $ = cheerio.load(html);
  const groups: Record<string, GroupData> = {};
  let started = false;

  for (const g of GROUPS) {
    const box = $(".content-box-headline")
      .filter((_, el) => $(el).text().trim() === `Group ${g}`)
      .closest(".box");
    const rows: GroupStanding[] = [];
    box.find("table.items tr").each((_, tr) => {
      const tds = $(tr).find("td");
      if (tds.length < 6) return;
      const name = teamIn(tds.eq(2));
      if (!name) return; // header / non-team row
      const cells = tds.map((_, c) => $(c).text().trim()).get();
      const goalsIdx = cells.findIndex((c) => /^\d+:\d+$/.test(c));
      rows.push({
        name,
        rank: intIn(cells[0]) ?? 0,
        played: goalsIdx > 1 ? (intIn(cells[goalsIdx - 2]) ?? 0) : 0,
        gd: goalsIdx > 0 ? (intIn(cells[goalsIdx - 1]) ?? 0) : 0,
        goals: goalsIdx >= 0 ? cells[goalsIdx] : "0:0",
        pts: intIn(cells[cells.length - 1]) ?? 0,
      });
    });
    const anyPlayed = rows.some((r) => r.played > 0);
    if (anyPlayed) started = true;
    groups[g] = { rows, complete: rows.length > 0 && rows.every((r) => r.played >= 3), anyPlayed };
  }

  // Knockout: one table of rows labelled "Ro32 1" … "FI".
  const koBox = $(".content-box-headline")
    .filter((_, el) => $(el).text().trim() === "Knockout stage")
    .closest(".box");
  const ko: KoMatch[] = [];
  koBox.find("tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 7) return;
    let info: { round: Round; num: number } | null = null;
    let labelIdx = -1;
    const cells = tds.toArray();
    for (let i = 0; i < cells.length; i++) {
      const li = parseLabel($(cells[i]).text());
      if (li) {
        info = li;
        labelIdx = i;
        break;
      }
    }
    if (!info || labelIdx < 0) return;
    let hs: number | null = null;
    let as: number | null = null;
    tds.each((_, td) => {
      const m = $(td)
        .text()
        .trim()
        .match(/^(\d+):(\d+)$/);
      if (m) {
        hs = parseInt(m[1], 10);
        as = parseInt(m[2], 10);
      }
    });
    if (hs !== null) started = true;
    ko.push({
      round: info.round,
      num: info.num,
      home: teamIn(tds.eq(labelIdx + 1)),
      away: teamIn(tds.eq(tds.length - 1)),
      hs,
      as,
    });
  });

  return { started, fetchedAt: Date.now(), groups, ko };
}

/** Live World Cup results from Transfermarkt (group standings + knockout), refreshed every 6h. */
export const getWcResults = unstable_cache(
  async (): Promise<WcResults> => {
    try {
      return await fetchResults();
    } catch (err) {
      console.error("[wc] failed to fetch live results, showing prediction only:", err);
      return { ...EMPTY, fetchedAt: Date.now() };
    }
  },
  ["wc-live-results"],
  { revalidate: 3600, tags: ["wc-live"] },
);
