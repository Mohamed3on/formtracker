import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cache } from "react";
import { BASE_TEAMS, type Team } from "./model";

/** The 48 World Cup teams with squad market values frozen at tournament end.
 *  data/wc/teams.json is written once by scripts/snapshot-wc.ts; the checked-in
 *  BASE_TEAMS covers a missing snapshot. */
export const getWcTeams = cache(async (): Promise<Team[]> => {
  try {
    return JSON.parse(await readFile(join(process.cwd(), "data", "wc", "teams.json"), "utf-8"));
  } catch {
    return BASE_TEAMS;
  }
});
