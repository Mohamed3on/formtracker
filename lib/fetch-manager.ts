import { unstable_cache } from "next/cache";
import * as cheerio from "cheerio";
import type { ManagerInfo, ManagerTrivia } from "@/app/types";
import { BASE_URL } from "./constants";
import { fetchPage } from "./fetch";

interface ManagerHistoryEntry {
  name: string;
  profileUrl: string;
  trainerId: string | null;
  appointedDate: string;
  endDate: string;
  matches: number;
  ppg: number | null;
}

function parseDate(dateStr: string): Date | null {
  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  return new Date(year, month - 1, day);
}

function formatYears(appointed: string, end: string): string {
  const startDate = parseDate(appointed);
  const endDate = end ? parseDate(end) : new Date();
  if (!startDate) return "";
  const startYear = startDate.getFullYear();
  const endYear = endDate?.getFullYear() || new Date().getFullYear();
  return startYear === endYear ? `${startYear}` : `${startYear}-${endYear}`;
}

function toTrivia(m: ManagerHistoryEntry): ManagerTrivia {
  return {
    name: m.name,
    profileUrl: m.profileUrl,
    ppg: m.ppg!,
    matches: m.matches,
    years: formatYears(m.appointedDate, m.endDate),
  };
}

function parseManagerTable($: cheerio.CheerioAPI): ManagerHistoryEntry[] {
  const managers: ManagerHistoryEntry[] = [];
  const rows = $("table.items tbody tr");

  rows.each((_, row) => {
    const $row = $(row);
    const cells = $row.find("> td");
    const inlineTable = $row.find(".inline-table");
    const link = inlineTable.find(".hauptlink a");
    const name = link.attr("title") || link.text().trim();
    const profileUrl = link.attr("href") || "";
    const trainerId = profileUrl.match(/\/trainer\/(\d+)/)?.[1] ?? null;

    if (!name) return;

    const appointedDate = $(cells[2]).text().trim();
    const endDate = $(cells[3]).text().trim();
    const matchesText = $(cells[5]).text().trim();
    const ppgText = $(cells[6]).text().trim();

    const matches = parseInt(matchesText, 10) || 0;
    const parsed = parseFloat(ppgText);
    const ppg = ppgText === "-" || isNaN(parsed) ? null : parsed;

    managers.push({
      name,
      profileUrl: profileUrl.startsWith("/") ? BASE_URL + profileUrl : profileUrl,
      trainerId,
      appointedDate,
      endDate,
      matches,
      ppg,
    });
  });

  return managers;
}

/** Read the compact totals table (Matches|W|D|L|Goals|Points|PPM) on a trainer's
 *  leistungsdatenDetail page. Returns zeros when the filter matched no games (no table). */
function parseSummary($: cheerio.CheerioAPI): {
  matches: number;
  points: number;
} {
  let matches = 0;
  let points = 0;
  $("table").each((_, t) => {
    const heads = $(t)
      .find("thead th")
      .map((_, th) => $(th).text().trim())
      .get();
    const ptIdx = heads.indexOf("Points");
    if (heads[0] !== "Matches" || ptIdx < 0) return; // skip the match-list table (starts "Date")
    const cells = $(t).find("tbody tr").first().find("td");
    matches = parseInt($(cells[0]).text().trim(), 10) || 0;
    points = parseInt($(cells[ptIdx]).text().trim(), 10) || 0;
  });
  return { matches, points };
}

/** DD/MM/YYYY → YYYY-MM-DD for Transfermarkt's datum_zu / datum_ab range filters. */
function toIsoDate(d: string): string | null {
  const [day, month, year] = d.split("/");
  return day && month && year ? `${year}-${month}-${day}` : null;
}

/** A manager's friendly-only record for one national-team stint, from Transfermarkt's
 *  detailed-performance page filtered to Friendlies (FS) and scoped to the stint's dates.
 *  Managers who coached the same nation twice (e.g. Leekens/Belgium) otherwise double-count
 *  friendlies across stints, wrecking the subtraction. datum_zu is the lower bound
 *  (appointed), datum_ab the upper (end); an open stint omits the upper bound.
 *
 *  A stint that has already ended can never gain another friendly, so it is cached for 30d
 *  while an open stint stays on the 6h cycle. Without that split every one of the ~130
 *  manager fetches behind /wc-live expired on the same 6h boundary, and the first build
 *  after each boundary refetched all of them — blowing the page's prerender budget. */
const ENDED_STINT_TTL = 2_592_000; // 30d — immutable history
const OPEN_STINT_TTL = 21_600; // 6h — the incumbent is still playing games

const getFriendlyRecord = (trainerId: string, vereinId: string, appointed: string, end: string) => {
  const endDate = end ? parseDate(end) : null;
  const ended = !!endDate && endDate < new Date();
  return unstable_cache(
    async () => {
      const from = toIsoDate(appointed);
      const to = toIsoDate(end); // toIsoDate("") → null, so an open stint drops the upper bound
      const url =
        `${BASE_URL}/x/leistungsdatenDetail/trainer/${trainerId}/plus/0` +
        `?verein_id=${vereinId}&wettbewerb_id=FS` +
        (from ? `&datum_zu=${from}` : "") +
        (to ? `&datum_ab=${to}` : "");
      return parseSummary(cheerio.load(await fetchPage(url)));
    },
    [`friendlies-${trainerId}-${vereinId}-${appointed}`],
    { revalidate: ended ? ENDED_STINT_TTL : OPEN_STINT_TTL, tags: ["manager"] },
  )();
};

async function fetchManagerInfoUncached(
  clubId: string,
  officialOnly: boolean,
): Promise<ManagerInfo | null> {
  const historyUrl = `${BASE_URL}/placeholder/mitarbeiterhistorie/verein/${clubId}`;
  const html = await fetchPage(historyUrl);
  const $ = cheerio.load(html);

  const allManagers = parseManagerTable($);
  if (allManagers.length === 0) {
    throw new Error(`No manager data found for club ${clubId}`);
  }

  const now = new Date();
  // The current manager is the row whose tenure is open now: appointed in the past
  // with no end date (or one still in the future). Skipping ended stints keeps a past
  // interim caretaker sitting atop the list (e.g. Egypt's) from masking the incumbent.
  const firstManager =
    allManagers.find((m) => {
      const appointed = parseDate(m.appointedDate);
      if (!appointed || appointed > now) return false;
      const end = m.endDate ? parseDate(m.endDate) : null;
      return !end || end > now;
    }) ?? allManagers[0];
  const endDate = firstManager.endDate ? parseDate(firstManager.endDate) : null;
  const isCurrentManager = !endDate || endDate > now;

  const minMatches = firstManager.matches;
  const since1995 = allManagers.filter((m) => {
    const appointed = parseDate(m.appointedDate);
    return (
      appointed && appointed.getFullYear() >= 1995 && m.matches >= minMatches && m.ppg !== null
    );
  });

  // Restate every comparable manager's PPG on competitive games only — Transfermarkt
  // blends friendlies into its PPG. Points are additive, so official = total − friendlies,
  // reusing TM's own points to avoid re-deriving knockout/penalty results. The history
  // table already gives exact total matches + PPG, so this is one extra fetch per manager
  // (the FS page). Restated rows are fresh objects; the parsed entries stay untouched.
  const comparable: ManagerHistoryEntry[] = officialOnly
    ? await Promise.all(
        since1995.map(async (m) => {
          if (m.ppg === null || !m.trainerId) return m;
          const totalPoints = Math.round(m.ppg * m.matches);
          const fs = await getFriendlyRecord(m.trainerId, clubId, m.appointedDate, m.endDate);
          const officialMatches = m.matches - fs.matches;
          if (officialMatches <= 0) return m; // only ever managed friendlies here — keep all-comps
          return {
            ...m,
            ppg: (totalPoints - fs.points) / officialMatches,
            matches: officialMatches,
          };
        }),
      )
    : since1995;

  const isIncumbent = (m: ManagerHistoryEntry) =>
    m.name === firstManager.name && m.appointedDate === firstManager.appointedDate;
  const incumbent = comparable.find(isIncumbent) ?? firstManager;
  const sorted = [...comparable].sort((a, b) => (b.ppg ?? 0) - (a.ppg ?? 0));
  const rank = sorted.indexOf(incumbent) + 1;

  const bestManager = sorted.length > 0 ? toTrivia(sorted[0]) : undefined;
  const worstManager = sorted.length > 0 ? toTrivia(sorted[sorted.length - 1]) : undefined;

  return {
    name: firstManager.name,
    profileUrl: firstManager.profileUrl,
    appointedDate: firstManager.appointedDate,
    matches: incumbent.matches,
    ppg: incumbent.ppg,
    isCurrentManager,
    ppgRank: rank > 0 ? rank : undefined,
    totalComparableManagers: since1995.length > 0 ? since1995.length : undefined,
    bestManager,
    worstManager,
    officialOnly,
  };
}

export const getManagerInfo = (clubId: string, officialOnly = false) =>
  unstable_cache(
    () => fetchManagerInfoUncached(clubId, officialOnly),
    [`manager-${clubId}${officialOnly ? "-official" : ""}`],
    { revalidate: 21600, tags: ["manager"] },
  )();
