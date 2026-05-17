import { unstable_cache } from "next/cache";
import * as cheerio from "cheerio";
import type { ManagerInfo, ManagerTrivia } from "@/app/types";
import { BASE_URL } from "./constants";
import { fetchPage } from "./fetch";

interface ManagerHistoryEntry {
  name: string;
  profileUrl: string;
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
      appointedDate,
      endDate,
      matches,
      ppg,
    });
  });

  return managers;
}

async function fetchManagerInfoUncached(clubId: string): Promise<ManagerInfo | null> {
  const historyUrl = `${BASE_URL}/placeholder/mitarbeiterhistorie/verein/${clubId}`;
  const html = await fetchPage(historyUrl);
  const $ = cheerio.load(html);

  const allManagers = parseManagerTable($);
  if (allManagers.length === 0) {
    throw new Error(`No manager data found for club ${clubId}`);
  }

  const firstManager = allManagers[0];
  const endDate = firstManager.endDate ? parseDate(firstManager.endDate) : null;
  const isCurrentManager = !endDate || endDate > new Date();

  const minMatches = firstManager.matches;
  const since1995 = allManagers.filter((m) => {
    const appointed = parseDate(m.appointedDate);
    return (
      appointed && appointed.getFullYear() >= 1995 && m.matches >= minMatches && m.ppg !== null
    );
  });

  const sorted = [...since1995].sort((a, b) => (b.ppg ?? 0) - (a.ppg ?? 0));
  const rank =
    sorted.findIndex(
      (m) => m.name === firstManager.name && m.appointedDate === firstManager.appointedDate,
    ) + 1;

  const bestManager = sorted.length > 0 ? toTrivia(sorted[0]) : undefined;
  const worstManager = sorted.length > 0 ? toTrivia(sorted[sorted.length - 1]) : undefined;

  return {
    name: firstManager.name,
    profileUrl: firstManager.profileUrl,
    appointedDate: firstManager.appointedDate,
    matches: firstManager.matches,
    ppg: firstManager.ppg,
    isCurrentManager,
    ppgRank: rank > 0 ? rank : undefined,
    totalComparableManagers: since1995.length > 0 ? since1995.length : undefined,
    bestManager,
    worstManager,
  };
}

export const getManagerInfo = (clubId: string) =>
  unstable_cache(() => fetchManagerInfoUncached(clubId), [`manager-${clubId}`], {
    revalidate: 21600,
    tags: ["manager"],
  })();
