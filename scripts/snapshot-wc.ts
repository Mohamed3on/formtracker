/**
 * One-shot archiver for the finished 2026 World Cup: fetches the tournament's
 * final state from Transfermarkt and freezes it into data/wc/*.json, which the
 * lib/wc readers serve from then on. The live-fetch adapters that used to live
 * in lib/wc/{teams,results,fixtures}.ts and re-scraped a settled tournament
 * daily now live here, run ~never.
 *
 *   SKIP_NEXT_CACHE=1 bun run scripts/snapshot-wc.ts
 */
process.env.SKIP_NEXT_CACHE = "1"; // getManagerInfo's unstable_cache can't run under bun

import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import * as cheerio from "cheerio";
import { fetchPage } from "@/lib/fetch";
import { parseMarketValue } from "@/lib/parse-market-value";
import { getManagerInfo } from "@/lib/fetch-manager";
import { BASE_TEAMS, normName, type Round, type Team } from "@/lib/wc/model";
import { buildLiveModel } from "@/lib/wc/live";
import { wcTeamTmId } from "@/lib/wc/tm-team-links";
import type { GroupFixture, Kick } from "@/lib/wc/fixtures";
import type { GroupStanding, GroupData, KoMatch, WcResults } from "@/lib/wc/results";
import type { ManagerInfo } from "@/app/types";

const OUT_DIR = join(process.cwd(), "data", "wc");
const TEILNEHMER_URL =
  "https://www.transfermarkt.com/weltmeisterschaft/teilnehmer/pokalwettbewerb/FIWC/saison_id/2025";
const FIXTURES_URL =
  "https://www.transfermarkt.com/weltmeisterschaft/gesamtspielplan/pokalwettbewerb/FIWC/saison_id/2025";
const GROUPS = "ABCDEFGHIJKL".split("");

// --- teams (final squad market values over the checked-in roster) ---

async function snapshotTeams(): Promise<Team[]> {
  const html = await fetchPage(TEILNEHMER_URL);
  const $ = cheerio.load(html);
  const mv: Record<string, number> = {};
  $("table.items")
    .first()
    .find("tbody > tr")
    .each((_, tr) => {
      const tds = $(tr).find("td");
      if (tds.length < 7) return;
      const name = normName($(tds.eq(1)).text());
      const euros = parseMarketValue(
        $(tds.eq(tds.length - 2))
          .text()
          .trim(),
      );
      if (name && euros > 0) mv[name] = euros / 1_000_000; // millions, like the model
    });
  const matched = BASE_TEAMS.filter((t) => mv[t.name] !== undefined).length;
  if (matched < 40) throw new Error(`participants parse matched only ${matched}/48 teams`);
  return BASE_TEAMS.map((t) => (mv[t.name] !== undefined ? { ...t, mv: mv[t.name] } : t));
}

// --- results (group standings + knockout bracket) ---

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

function teamIn(cell: cheerio.Cheerio<any>): string | null {
  const link = cell.find("a[href*='/verein/']").first();
  return link.length ? normName(link.text()) : null;
}

function parseResults(html: string): WcResults {
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
    // The score lives in the result cell — the one linking to the match report/preview.
    // Prefix match so "4:5 on pens" / "2:1 a.e.t." parse and kickoff times never match.
    let hs: number | null = null;
    let as: number | null = null;
    let pens = false;
    const resultText = tds
      .filter((_, td) => $(td).find("a[href*='/spielbericht/']").length > 0)
      .first()
      .text()
      .trim();
    const score = resultText.match(/^(\d+):(\d+)/);
    if (score) {
      hs = parseInt(score[1], 10);
      as = parseInt(score[2], 10);
      pens = /pen/i.test(resultText);
      started = true;
    }
    ko.push({
      round: info.round,
      num: info.num,
      home: teamIn(tds.eq(labelIdx + 1)),
      away: teamIn(tds.eq(tds.length - 1)),
      hs,
      as,
      pens,
    });
  });

  return { started, fetchedAt: Date.now(), groups, ko };
}

// --- fixtures (group games with kickoffs) + knockout schedule ---

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "Tue 16/06/2026 9:00 PM" — the date/time header that precedes each fixture row.
const DT = /([A-Za-z]{3})\s+(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s?(AM|PM)/i;

function parseKick(text: string): Kick | null {
  const m = text.match(DT);
  if (!m) return null;
  let h = parseInt(m[5], 10);
  if (/PM/i.test(m[7]) && h !== 12) h += 12;
  if (/AM/i.test(m[7]) && h === 12) h = 0;
  return {
    kickoff: +`${m[4]}${m[3]}${m[2]}${String(h).padStart(2, "0")}${m[6]}`,
    dow: m[1],
    dayLabel: `${parseInt(m[2], 10)} ${MONTH[parseInt(m[3], 10) - 1]}`,
    timeLabel: `${m[5]}:${m[6]} ${m[7].toUpperCase()}`,
  };
}

function parseFixtures(html: string): GroupFixture[] {
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
        const k = parseKick(cells[0]);
        if (k) cur = k;
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

// TM labels each knockout fixture "Ro32 1" … "FI"/"3rd"; map to bracket card keys.
function koKey(cell: string): string | null {
  if (/3rd/i.test(cell)) return "3RD"; // labelled "FI 3rd" (third-place play-off)
  const m = cell.match(/^(Ro32|Ro16|QF|SF|FI)\s*(\d+)?$/i);
  if (!m) return null;
  const tag = m[1].toUpperCase();
  if (tag === "FI") return "F-1";
  const round = tag === "RO32" ? "R32" : tag === "RO16" ? "R16" : tag;
  return `${round}-${m[2] ?? "1"}`;
}

function parseKnockoutSchedule(html: string): Record<string, Kick> {
  const $ = cheerio.load(html);
  const out: Record<string, Kick> = {};
  const box = $(".content-box-headline")
    .filter((_, el) => $(el).text().trim() === "Knockout stage")
    .closest(".box");
  // Same-day matches share one date cell — track the latest and apply forward.
  let cur: Kick | null = null;
  box.find("tr").each((_, tr) => {
    const cells = $(tr)
      .find("td")
      .map((_, c) => $(c).text().trim().replace(/\s+/g, " "))
      .get();
    const kick = parseKick(cells.join(" "));
    if (kick) cur = kick;
    const key = cells.map(koKey).find(Boolean);
    if (key && cur) out[key] = cur;
  });
  return out;
}

// --- managers for nations off their value seeding ---

async function snapshotManagers(
  teams: Team[],
  results: WcResults,
): Promise<Record<string, ManagerInfo>> {
  const tracker = buildLiveModel(teams, results).tracker;
  const names = tracker.filter((r) => r.projStage !== r.expStage).map((r) => r.team.name);
  console.log(`[wc-snapshot] fetching ${names.length} nation managers...`);
  const settled = await Promise.allSettled(
    names.map(async (name) => {
      const id = wcTeamTmId(name);
      return id ? ([name, await getManagerInfo(String(id), true)] as const) : null;
    }),
  );
  const managers: Record<string, ManagerInfo> = {};
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value && r.value[1]) managers[r.value[0]] = r.value[1];
  }
  if (Object.keys(managers).length < names.length * 0.8) {
    throw new Error(
      `only ${Object.keys(managers).length}/${names.length} managers resolved — refusing partial snapshot`,
    );
  }
  return managers;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const [teams, scheduleHtml] = await Promise.all([snapshotTeams(), fetchPage(FIXTURES_URL)]);
  const results = parseResults(scheduleHtml);
  const fixtures = parseFixtures(scheduleHtml);
  const knockoutSchedule = parseKnockoutSchedule(scheduleHtml);

  if (!results.started || !results.ko.some((m) => m.round === "F" && m.hs !== null)) {
    throw new Error("results parse has no completed final — refusing to freeze");
  }
  if (fixtures.length < 60) {
    throw new Error(`only ${fixtures.length} group fixtures parsed — refusing to freeze`);
  }

  const managers = await snapshotManagers(teams, results);

  await writeFile(join(OUT_DIR, "teams.json"), JSON.stringify(teams, null, 1));
  await writeFile(join(OUT_DIR, "results.json"), JSON.stringify(results, null, 1));
  await writeFile(join(OUT_DIR, "fixtures.json"), JSON.stringify(fixtures, null, 1));
  await writeFile(
    join(OUT_DIR, "knockout-schedule.json"),
    JSON.stringify(knockoutSchedule, null, 1),
  );
  await writeFile(join(OUT_DIR, "managers.json"), JSON.stringify(managers, null, 1));
  console.log(
    `[wc-snapshot] frozen: ${teams.length} teams, ${results.ko.length} KO matches, ${fixtures.length} fixtures, ${Object.keys(managers).length} managers → ${OUT_DIR}`,
  );
}

main().catch((err) => {
  console.error("[wc-snapshot] Fatal:", err);
  process.exit(1);
});
