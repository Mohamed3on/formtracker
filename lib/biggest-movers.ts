import { readFile } from "fs/promises";
import { join } from "path";
import { cache } from "react";
import type { MarketValueMoversResult } from "@/app/types";

async function readMovers(file: string): Promise<MarketValueMoversResult> {
  const raw = await readFile(join(process.cwd(), "data", file), "utf-8");
  const data = JSON.parse(raw) as MarketValueMoversResult;
  data.repeatMovers.sort(
    (a, b) =>
      b.reduce((s, m) => s + m.absoluteChange, 0) - a.reduce((s, m) => s + m.absoluteChange, 0),
  );
  return data;
}

// Plain per-request reads, deduped with React cache. These JSONs only change via
// data-refresh deploys, so a cross-deploy unstable_cache could only serve them stale.
export const findRepeatLosers = cache(() => readMovers("biggest-losers.json"));
export const findRepeatWinners = cache(() => readMovers("biggest-winners.json"));
