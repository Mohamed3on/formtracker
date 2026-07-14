import { unstable_cache } from "next/cache";
import * as cheerio from "cheerio";
import type { InjuredPlayer } from "@/app/types";
import { BASE_URL } from "@/lib/constants";
import { LEAGUES } from "@/lib/leagues";
import { fetchPage } from "@/lib/fetch";
import { parseMarketValue } from "@/lib/parse-market-value";

function parseInjuredPlayers($: cheerio.CheerioAPI, leagueName: string): InjuredPlayer[] {
  const players: InjuredPlayer[] = [];
  $("table.items > tbody > tr").each((_, row) => {
    const cells = $(row).find("> td");
    if (cells.length < 8) return;
    const nameCell = $(cells[0]);
    const inlineTable = nameCell.find(".inline-table");
    const playerLink = inlineTable.find(".hauptlink a").first();
    const name = playerLink.attr("title") || playerLink.text().trim();
    const profileUrl = playerLink.attr("href") || "";
    const position = inlineTable.find("tr:last-child td").text().trim();
    const imageUrl = (
      inlineTable.find("img").attr("data-src") ||
      inlineTable.find("img").attr("src") ||
      ""
    ).replace("/small/", "/header/");
    const clubCell = $(cells[1]);
    const clubLink = clubCell.find("a").first();
    const club = clubLink.attr("title") || "";
    const clubLogoUrl = (clubCell.find("img").attr("src") || "").replace("/tiny/", "/head/");
    const age = parseInt($(cells[2]).text().trim(), 10) || undefined;
    const injury = $(cells[4]).text().trim();
    const injurySince = $(cells[5]).text().trim();
    const returnDate = $(cells[6]).text().trim();
    const marketValue = $(cells[7]).text().trim();
    const marketValueNum = parseMarketValue(marketValue);
    if (name && marketValueNum > 0) {
      players.push({
        name,
        position,
        club,
        clubLogoUrl,
        injury,
        returnDate,
        injurySince,
        age,
        marketValue,
        marketValueNum,
        imageUrl,
        profileUrl: profileUrl ? `${BASE_URL}${profileUrl}` : "",
        league: leagueName,
      });
    }
  });
  return players;
}

export async function fetchInjuredPlayersUncached(): Promise<{
  success: boolean;
  players: InjuredPlayer[];
  totalPlayers: number;
  leagues: string[];
}> {
  const MAX_ATTEMPTS = 3;
  const allPlayers: InjuredPlayer[] = [];
  const leagueSet = new Set<string>();
  let pending = [...LEAGUES];

  // Retry leagues that fail rather than surfacing them to the client. Degrade
  // gracefully on persistent failure: the injured data also feeds the injury
  // map on other pages, so partial data beats throwing. (Mirrors team-form.)
  for (let attempt = 1; attempt <= MAX_ATTEMPTS && pending.length > 0; attempt++) {
    const results = await Promise.allSettled(
      pending.map(async (league) => {
        const url = `${BASE_URL}/${league.slug}/verletztespieler/wettbewerb/${league.code}/plus/1`;
        return parseInjuredPlayers(cheerio.load(await fetchPage(url)), league.name);
      }),
    );

    const nextPending: typeof pending = [];
    results.forEach((result, i) => {
      if (result.status === "fulfilled") {
        allPlayers.push(...result.value);
        leagueSet.add(pending[i].name);
      } else {
        nextPending.push(pending[i]);
      }
    });
    pending = nextPending;

    if (pending.length > 0 && attempt < MAX_ATTEMPTS) {
      console.warn(
        `injured attempt ${attempt}/${MAX_ATTEMPTS}: retrying ${pending.map((l) => l.name).join(", ")}`,
      );
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }

  if (pending.length > 0) {
    console.warn(
      `injured: gave up on ${pending.map((l) => l.name).join(", ")} after ${MAX_ATTEMPTS} attempts`,
    );
  }

  allPlayers.sort((a, b) => b.marketValueNum - a.marketValueNum);

  return {
    success: true,
    players: allPlayers,
    totalPlayers: allPlayers.length,
    leagues: [...leagueSet],
  };
}

export const getInjuredPlayers = unstable_cache(fetchInjuredPlayersUncached, ["injured-players"], {
  revalidate: 7200,
  tags: ["injured"],
});
