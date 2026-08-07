import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cache } from "react";

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

export type Kick = { kickoff: number; dow: string; dayLabel: string; timeLabel: string };

/** Group-stage fixtures with final scores, frozen by scripts/snapshot-wc.ts. */
export const getWcFixtures = cache(async (): Promise<GroupFixture[]> => {
  try {
    return JSON.parse(await readFile(join(process.cwd(), "data", "wc", "fixtures.json"), "utf-8"));
  } catch (err) {
    console.error("[wc] missing fixtures snapshot:", err);
    return [];
  }
});

/** Official knockout kickoff dates keyed by bracket card (`${round}-${num}`, plus "3RD"). */
export const getWcKnockoutSchedule = cache(async (): Promise<Record<string, Kick>> => {
  try {
    return JSON.parse(
      await readFile(join(process.cwd(), "data", "wc", "knockout-schedule.json"), "utf-8"),
    );
  } catch (err) {
    console.error("[wc] missing knockout-schedule snapshot:", err);
    return {};
  }
});
