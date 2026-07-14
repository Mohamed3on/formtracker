import { unstable_cache } from "next/cache";
import * as cheerio from "cheerio";
import type { TeamFormEntry } from "@/app/types";
import { BASE_URL } from "./constants";
import { LEAGUES } from "./leagues";
import { fetchPage } from "./fetch";
import { parseMarketValue } from "./parse-market-value";
import { tmImage } from "@/lib/transfermarkt";
interface LeagueTeam {
  name: string;
  position: number;
  points: number;
  logoUrl: string;
  clubUrl: string;
  clubId: string;
}

interface MarketValueTeam {
  clubId: string;
  marketValue: string;
  marketValueNum: number;
}

function parseStartseitePage($: cheerio.CheerioAPI): {
  standings: LeagueTeam[];
  marketValues: MarketValueTeam[];
} {
  const standings: LeagueTeam[] = [];
  const marketValues: MarketValueTeam[] = [];

  const standingsTable = $("table.items")
    .filter((_, table) => {
      const headerText = $(table).find("thead").text().toLowerCase();
      const hasPts = headerText.includes("pts") || headerText.includes("pkte");
      const hasMarketValue =
        headerText.includes("market value") || headerText.includes("marktwert");
      return hasPts && !hasMarketValue;
    })
    .first();

  standingsTable.find("tbody > tr").each((_, row) => {
    const cells = $(row).find("> td");
    if (cells.length < 5) return;

    const positionText = $(cells[0]).text().trim();
    const position = parseInt(positionText, 10);
    if (isNaN(position)) return;

    const clubCell = $(cells[1]);
    const clubLink = clubCell.find("a").first();
    const logoUrl = tmImage(clubCell.find("img").attr("src") || "");
    const name = clubLink.attr("title") || "";
    const clubUrl = clubLink.attr("href") || "";
    const clubIdMatch = clubUrl.match(/\/verein\/(\d+)/);
    const clubId = clubIdMatch ? clubIdMatch[1] : "";

    const pointsText = $(cells[cells.length - 1])
      .text()
      .trim();
    const points = parseInt(pointsText, 10);
    if (isNaN(points)) return;

    if (name && clubId) {
      const normalizedUrl = clubUrl.replace(/\/(spielplan|tabelle)\//, "/startseite/");
      standings.push({
        name,
        position,
        points,
        logoUrl,
        clubUrl: `${BASE_URL}${normalizedUrl}`,
        clubId,
      });
    }
  });

  const mvTable = $("table.items")
    .filter((_, table) => {
      const headerText = $(table).find("thead").text().toLowerCase();
      return headerText.includes("market value") || headerText.includes("marktwert");
    })
    .first();

  mvTable.find("tbody > tr").each((_, row) => {
    const cells = $(row).find("> td");
    if (cells.length < 6) return;

    const nameCell = $(cells[1]);
    const clubUrl = nameCell.find("a").first().attr("href") || "";
    const clubIdMatch = clubUrl.match(/\/verein\/(\d+)/);
    const clubId = clubIdMatch ? clubIdMatch[1] : "";

    const mvCell = $(cells[cells.length - 2]);
    const marketValue = mvCell.text().trim();
    const marketValueNum = parseMarketValue(marketValue);

    if (clubId && marketValueNum > 0) {
      marketValues.push({ clubId, marketValue, marketValueNum });
    }
  });

  return { standings, marketValues };
}

async function fetchLeagueData(league: (typeof LEAGUES)[number]): Promise<TeamFormEntry[]> {
  try {
    const url = `${BASE_URL}/${league.slug}/startseite/wettbewerb/${league.code}`;
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    const { standings, marketValues } = parseStartseitePage($);

    const sortedByMV = [...marketValues].sort((a, b) => b.marketValueNum - a.marketValueNum);
    const mvRankMap = new Map<string, { rank: number; value: string; valueNum: number }>();
    sortedByMV.forEach((team, idx) => {
      mvRankMap.set(team.clubId, {
        rank: idx + 1,
        value: team.marketValue,
        valueNum: team.marketValueNum,
      });
    });

    const pointsByPosition = new Map<number, number>();
    standings.forEach((team) => {
      pointsByPosition.set(team.position, team.points);
    });

    const results: TeamFormEntry[] = [];
    for (const team of standings) {
      const mvData = mvRankMap.get(team.clubId);
      if (!mvData) continue;

      const expectedPosition = mvData.rank;
      const expectedPoints = pointsByPosition.get(expectedPosition) || team.points;
      const deltaPts = team.points - expectedPoints;

      results.push({
        name: team.name,
        league: league.name,
        leaguePosition: team.position,
        points: team.points,
        marketValue: mvData.value,
        marketValueNum: mvData.valueNum,
        marketValueRank: mvData.rank,
        expectedPoints,
        deltaPts,
        logoUrl: team.logoUrl,
        clubUrl: team.clubUrl,
        clubId: team.clubId,
      });
    }

    return results;
  } catch (error) {
    console.error(`Failed to fetch ${league.name}:`, error);
    throw error;
  }
}

export function splitPerformers(teams: TeamFormEntry[], limit?: number) {
  const over = teams
    .filter((t) => t.deltaPts > 0)
    .sort((a, b) => b.deltaPts - a.deltaPts || b.marketValueNum - a.marketValueNum);
  const under = teams
    .filter((t) => t.deltaPts < 0)
    .sort((a, b) => a.deltaPts - b.deltaPts || b.marketValueNum - a.marketValueNum);
  return {
    overperformers: limit ? over.slice(0, limit) : over,
    underperformers: limit ? under.slice(0, limit) : under,
  };
}

export const getTeamFormData = unstable_cache(
  async () => {
    const MAX_ATTEMPTS = 3;
    const allTeams: TeamFormEntry[] = [];
    let pending = [...LEAGUES];

    for (let attempt = 1; attempt <= MAX_ATTEMPTS && pending.length > 0; attempt++) {
      const results = await Promise.allSettled(pending.map(fetchLeagueData));
      const nextPending: typeof pending = [];

      results.forEach((r, i) => {
        if (r.status === "fulfilled") {
          allTeams.push(...r.value);
        } else {
          nextPending.push(pending[i]);
        }
      });

      pending = nextPending;

      if (pending.length > 0) {
        console.warn(
          `team-form attempt ${attempt}/${MAX_ATTEMPTS}: missing leagues: ${pending.map((l) => l.name).join(", ")}`,
        );
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 2000 * attempt));
        }
      }
    }

    if (pending.length > 0) {
      throw new Error(
        `Failed to fetch all 5 leagues after ${MAX_ATTEMPTS} attempts. Missing: ${pending.map((l) => l.name).join(", ")}`,
      );
    }

    return {
      success: true,
      allTeams,
      leagues: LEAGUES.map((l) => l.name),
    };
  },
  ["team-form"],
  { revalidate: 7200, tags: ["team-form"] },
);
