import { unstable_cache } from "next/cache";
import * as cheerio from "cheerio";
import type { TeamStats, PeriodAnalysis, AnalysisResult, AggregatedTeam } from "@/app/types";
import { BASE_URL } from "@/lib/constants";
import { fetchPage } from "@/lib/fetch";
import { isSameLeague } from "@/lib/leagues";
import { tmImage } from "@/lib/transfermarkt";

const PERIODS = [20, 15, 10, 5];

const TOP_CATEGORIES = [
  { key: "points" as const, label: "Most Points" },
  { key: "goalDiff" as const, label: "Best GD" },
  { key: "goalsScored" as const, label: "Most Goals Scored" },
  { key: "goalsConceded" as const, label: "Fewest Conceded" },
];

const BOTTOM_CATEGORIES = [
  { key: "points" as const, label: "Fewest Points" },
  { key: "goalDiff" as const, label: "Worst GD" },
  { key: "goalsScored" as const, label: "Fewest Goals Scored" },
  { key: "goalsConceded" as const, label: "Most Conceded" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseTeamRow($: cheerio.CheerioAPI, row: any): TeamStats | null {
  const cells = $(row).find("> td");
  if (cells.length < 11) return null;

  const nameCell = $(cells[1]);
  const clubLink = nameCell.find(".inline-table a").first();
  const name = clubLink.attr("title") || nameCell.find(".hauptlink a").first().text().trim();
  const league = nameCell.find("table tr:last-child a").text().trim();
  const leaguePosition = parseInt($(cells[2]).text().trim()) || 0;
  const country = $(cells[3]).find("img").attr("title") || "";

  // Extract logo URL and club URL
  const logoImg = nameCell.find(".inline-table img").first();
  const logoUrl = tmImage(logoImg.attr("src") || "");
  const clubUrl = clubLink.attr("href") || "";
  const clubIdMatch = clubUrl.match(/\/verein\/(\d+)/);
  const clubId = clubIdMatch ? clubIdMatch[1] : "";

  const wins = parseInt($(cells[5]).text().trim()) || 0;
  const draws = parseInt($(cells[6]).text().trim()) || 0;
  const losses = parseInt($(cells[7]).text().trim()) || 0;

  const goalsText = $(cells[8]).text().trim();
  const [scored, conceded] = goalsText.split(":").map((n) => parseInt(n) || 0);

  const goalDiff = parseInt($(cells[9]).text().trim()) || 0;
  const points = parseInt($(cells[10]).text().trim()) || 0;

  if (!name) return null;
  return {
    name,
    league,
    country,
    leaguePosition,
    wins,
    draws,
    losses,
    goalsScored: scored,
    goalsConceded: conceded,
    goalDiff,
    points,
    logoUrl,
    clubUrl,
    clubId,
  };
}

const AJAX_HEADERS = { "X-Requested-With": "XMLHttpRequest" };

async function fetchAllTeams(period: number): Promise<TeamStats[]> {
  const teams: TeamStats[] = [];
  const baseUrl = `${BASE_URL}/verein-statistik/formtabelle/statistik/stat/ajax/yw1/sortierung/best/letzte/${period}/continentIds%5B0%5D/6/limit/5/leagueLevels%5B0%5D/1/typeIds%5B0%5D/1/typeIds%5B1%5D/2/typeIds%5B2%5D/3/plus/1/sort/punkte.desc?ajax=yw1`;

  const pageUrls = Array.from({ length: 4 }, (_, i) => {
    const page = i + 1;
    return page === 1 ? baseUrl : `${baseUrl.replace("?ajax=yw1", "")}/page/${page}?ajax=yw1`;
  });

  // fetchPage limits concurrency globally to avoid rate limiting
  const pages = await Promise.all(pageUrls.map((url) => fetchPage(url, undefined, AJAX_HEADERS)));

  for (const html of pages) {
    const $ = cheerio.load(html);
    $("table.items > tbody > tr").each((_, row) => {
      const team = parseTeamRow($, row);
      if (team?.name) teams.push(team);
    });
  }
  return teams;
}

function getLeaders(teams: TeamStats[]) {
  if (teams.length === 0) {
    const empty = { value: 0, teams: [] as string[] };
    return {
      top: { points: empty, goalDiff: empty, goalsScored: empty, goalsConceded: empty },
      bottom: { points: empty, goalDiff: empty, goalsScored: empty, goalsConceded: empty },
    };
  }
  const maxPoints = Math.max(...teams.map((t) => t.points));
  const maxGoalDiff = Math.max(...teams.map((t) => t.goalDiff));
  const maxGoalsScored = Math.max(...teams.map((t) => t.goalsScored));
  const minGoalsConceded = Math.min(...teams.map((t) => t.goalsConceded));
  const minPoints = Math.min(...teams.map((t) => t.points));
  const minGoalDiff = Math.min(...teams.map((t) => t.goalDiff));
  const minGoalsScored = Math.min(...teams.map((t) => t.goalsScored));
  const maxGoalsConceded = Math.max(...teams.map((t) => t.goalsConceded));

  return {
    top: {
      points: {
        value: maxPoints,
        teams: teams.filter((t) => t.points === maxPoints).map((t) => t.name),
      },
      goalDiff: {
        value: maxGoalDiff,
        teams: teams.filter((t) => t.goalDiff === maxGoalDiff).map((t) => t.name),
      },
      goalsScored: {
        value: maxGoalsScored,
        teams: teams.filter((t) => t.goalsScored === maxGoalsScored).map((t) => t.name),
      },
      goalsConceded: {
        value: minGoalsConceded,
        teams: teams.filter((t) => t.goalsConceded === minGoalsConceded).map((t) => t.name),
      },
    },
    bottom: {
      points: {
        value: minPoints,
        teams: teams.filter((t) => t.points === minPoints).map((t) => t.name),
      },
      goalDiff: {
        value: minGoalDiff,
        teams: teams.filter((t) => t.goalDiff === minGoalDiff).map((t) => t.name),
      },
      goalsScored: {
        value: minGoalsScored,
        teams: teams.filter((t) => t.goalsScored === minGoalsScored).map((t) => t.name),
      },
      goalsConceded: {
        value: maxGoalsConceded,
        teams: teams.filter((t) => t.goalsConceded === maxGoalsConceded).map((t) => t.name),
      },
    },
  };
}

function findQualifiedTeams(
  teams: TeamStats[],
  type: "top" | "bottom",
  leaders: ReturnType<typeof getLeaders>,
) {
  const data = leaders[type];
  const categories = type === "top" ? TOP_CATEGORIES : BOTTOM_CATEGORIES;
  const results: { team: TeamStats; criteria: string[] }[] = [];

  for (const team of teams) {
    const criteria: string[] = [];
    for (const { key, label } of categories) {
      if (data[key].teams.includes(team.name)) criteria.push(label);
    }
    if (criteria.length >= 2) results.push({ team, criteria });
  }
  return results;
}

async function fetchAllPeriodsWithRetry(): Promise<TeamStats[][]> {
  const settled = await Promise.allSettled(PERIODS.map(fetchAllTeams));
  const results = settled.map((r, i) => {
    if (r.status === "fulfilled" && r.value.length > 0) return r.value;
    if (r.status === "rejected") {
      console.error(`[form] Period ${PERIODS[i]} rejected:`, r.reason);
    } else {
      console.warn(`[form] Period ${PERIODS[i]} returned empty rows`);
    }
    return null;
  });

  // Retry failed periods once, sequentially to avoid overwhelming rate limiter
  const failedIndices = results.flatMap((r, i) => (r === null ? [i] : []));
  if (failedIndices.length > 0 && failedIndices.length < PERIODS.length) {
    console.warn(
      `[form] Retrying failed periods: ${failedIndices.map((i) => PERIODS[i]).join(", ")}`,
    );
    await new Promise((r) => setTimeout(r, 5000));
    for (const i of failedIndices) {
      try {
        const teams = await fetchAllTeams(PERIODS[i]);
        if (teams.length > 0) results[i] = teams;
      } catch (err) {
        console.error(`[form] Retry failed for period ${PERIODS[i]}:`, err);
      }
    }
  }

  const missing = results.flatMap((r, i) => (r === null ? [PERIODS[i]] : []));
  if (missing.length > 0) {
    throw new Error(
      `Incomplete form data — missing ${missing.length}/4 windows: ${missing.join(", ")}`,
    );
  }

  return results as TeamStats[][];
}

function analyzeFormData(allTeamsPerPeriod: TeamStats[][]): AnalysisResult {
  const analysis: PeriodAnalysis[] = [];
  let matchedPeriod: number | null = null;
  const leadersPerPeriod = allTeamsPerPeriod.map((teams) =>
    teams.length > 0 ? getLeaders(teams) : null,
  );

  for (let i = 0; i < PERIODS.length; i++) {
    const period = PERIODS[i];
    const teams = allTeamsPerPeriod[i];
    const leaders = leadersPerPeriod[i];
    if (teams.length === 0 || !leaders) continue;

    const topTeams = findQualifiedTeams(teams, "top", leaders);
    const bottomTeams = findQualifiedTeams(teams, "bottom", leaders);

    const periodData: PeriodAnalysis = {
      period,
      teamsAnalyzed: teams.length,
      leaders,
      topTeams: topTeams.map(({ team, criteria }) => ({
        name: team.name,
        league: team.league,
        country: team.country,
        leaguePosition: team.leaguePosition,
        criteria,
        stats: {
          points: team.points,
          goalDiff: team.goalDiff,
          goalsScored: team.goalsScored,
          goalsConceded: team.goalsConceded,
        },
        logoUrl: team.logoUrl,
        clubUrl: team.clubUrl,
        clubId: team.clubId,
      })),
      bottomTeams: bottomTeams.map(({ team, criteria }) => ({
        name: team.name,
        league: team.league,
        country: team.country,
        leaguePosition: team.leaguePosition,
        criteria,
        stats: {
          points: team.points,
          goalDiff: team.goalDiff,
          goalsScored: team.goalsScored,
          goalsConceded: team.goalsConceded,
        },
        logoUrl: team.logoUrl,
        clubUrl: team.clubUrl,
        clubId: team.clubId,
      })),
      hasMatch: topTeams.length > 0 && bottomTeams.length > 0,
    };

    analysis.push(periodData);

    if (periodData.hasMatch && !matchedPeriod) {
      matchedPeriod = period;
    }
  }

  const aggregateEntries = (type: "top" | "bottom") => {
    const teamMap = new Map<
      string,
      { team: TeamStats; entries: { category: string; period: number; value: number }[] }
    >();

    for (let i = 0; i < PERIODS.length; i++) {
      const period = PERIODS[i];
      const teams = allTeamsPerPeriod[i];
      const leaders = leadersPerPeriod[i];
      if (teams.length === 0 || !leaders) continue;
      const data = leaders[type];

      const categories = type === "top" ? TOP_CATEGORIES : BOTTOM_CATEGORIES;

      for (const { key, label } of categories) {
        const value = data[key].value;
        for (const teamName of data[key].teams) {
          const team = teams.find((t) => t.name === teamName);
          if (!team) continue;
          const existing = teamMap.get(team.clubId);
          if (existing) {
            existing.entries.push({ category: label, period, value });
          } else {
            teamMap.set(team.clubId, { team, entries: [{ category: label, period, value }] });
          }
        }
      }
    }

    const result: AggregatedTeam[] = [];
    for (const [, { team, entries }] of teamMap) {
      if (entries.length < 2) continue;
      const longestPeriod = Math.max(...entries.map((e) => e.period));
      const longestPeriodTeams = allTeamsPerPeriod[PERIODS.indexOf(longestPeriod)];
      const statsTeam = longestPeriodTeams.find((t) => t.clubId === team.clubId) || team;
      result.push({
        name: team.name,
        league: team.league,
        leaguePosition: team.leaguePosition,
        logoUrl: team.logoUrl,
        clubUrl: team.clubUrl,
        clubId: team.clubId,
        count: entries.length,
        entries,
        stats: {
          points: statsTeam.points,
          goalDiff: statsTeam.goalDiff,
          goalsScored: statsTeam.goalsScored,
          goalsConceded: statsTeam.goalsConceded,
        },
      });
    }
    return result.sort((a, b) => b.count - a.count);
  };

  return {
    success: matchedPeriod !== null,
    matchedPeriod,
    analysis,
    aggregatedTop: aggregateEntries("top"),
    aggregatedBottom: aggregateEntries("bottom"),
    allTeamsPerPeriod: PERIODS.map((period, i) => ({ period, teams: allTeamsPerPeriod[i] })),
  };
}

export const getAnalysis = unstable_cache(
  async (): Promise<AnalysisResult> => {
    const allTeamsPerPeriod = await fetchAllPeriodsWithRetry();
    return analyzeFormData(allTeamsPerPeriod);
  },
  ["form-analysis"],
  { revalidate: 7200, tags: ["form-analysis"] },
);

/**
 * Re-runs the form analysis scoped to a single league — leaders are computed
 * within just the league's teams, not across all top-5 leagues. Compares via
 * slug to handle scraped name variants like "La Liga" vs "LaLiga".
 */
export async function getLeagueAnalysis(leagueName: string): Promise<AnalysisResult> {
  const full = await getAnalysis();
  const periodTeams = (full.allTeamsPerPeriod ?? []).map((p) => p.teams);
  const leagueOnly = periodTeams.map((teams) =>
    teams.filter((t) => isSameLeague(t.league, leagueName)),
  );
  return analyzeFormData(leagueOnly);
}
