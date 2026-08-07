import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cache } from "react";
import type { Round } from "./model";

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
  pens: boolean; // tie decided by a penalty shootout (score shown is the shootout tally)
};
export type WcResults = {
  started: boolean;
  fetchedAt: number;
  groups: Record<string, GroupData>;
  ko: KoMatch[];
};

const EMPTY: WcResults = { started: false, fetchedAt: 0, groups: {}, ko: [] };

/** Final 2026 World Cup results, frozen by scripts/snapshot-wc.ts. */
export const getWcResults = cache(async (): Promise<WcResults> => {
  try {
    return JSON.parse(await readFile(join(process.cwd(), "data", "wc", "results.json"), "utf-8"));
  } catch (err) {
    console.error("[wc] missing results snapshot, showing prediction only:", err);
    return { ...EMPTY, fetchedAt: Date.now() };
  }
});
