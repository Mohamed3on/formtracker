import { unstable_cache } from "next/cache";
import * as cheerio from "cheerio";
import { fetchPage } from "@/lib/fetch";
import { parseMarketValue } from "@/lib/parse-market-value";
import { BASE_TEAMS, normName, type Team } from "./model";

const TEILNEHMER_URL =
  "https://www.transfermarkt.com/weltmeisterschaft/teilnehmer/pokalwettbewerb/FIWC/saison_id/2025";

async function fetchMarketValues(): Promise<Record<string, number>> {
  const html = await fetchPage(TEILNEHMER_URL, 86400);
  const $ = cheerio.load(html);
  const out: Record<string, number> = {};
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
      if (name && euros > 0) out[name] = euros / 1_000_000; // store in millions, like the model
    });
  return out;
}

/**
 * The 48 World Cup teams with daily-refreshed squad market values.
 * Roster/groups/flags are fixed (the draw is done); only the MV numbers move.
 * Falls back to the snapshot in BASE_TEAMS if the scrape fails or looks broken.
 */
export const getWcTeams = unstable_cache(
  async (): Promise<Team[]> => {
    try {
      const mv = await fetchMarketValues();
      const matched = BASE_TEAMS.filter((t) => mv[t.name] !== undefined).length;
      if (matched < 40) {
        console.warn(
          `[wc] participants parse matched only ${matched}/48 teams — using snapshot MVs`,
        );
        return BASE_TEAMS;
      }
      return BASE_TEAMS.map((t) => (mv[t.name] !== undefined ? { ...t, mv: mv[t.name] } : t));
    } catch (err) {
      console.error("[wc] failed to fetch participant market values, using snapshot:", err);
      return BASE_TEAMS;
    }
  },
  ["wc-teams"],
  { revalidate: 86400, tags: ["wc-teams"] },
);
