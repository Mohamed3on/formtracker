import { readFile } from "fs/promises";
import { join } from "path";
import { cache } from "react";
import { analyzeTransfers, type FeeVsValueData } from "./fee-vs-value";
import type { TopTransfer } from "@/app/types";

// Plain per-request read, deduped with React cache. The JSON only changes via a
// data-refresh deploy, so an unstable_cache could only ever serve it stale.
export const getFeeVsValueData = cache(async (): Promise<FeeVsValueData> => {
  const raw = await readFile(join(process.cwd(), "data", "top-transfers.json"), "utf-8");
  const { season, transfers } = JSON.parse(raw) as { season: number; transfers: TopTransfer[] };
  return analyzeTransfers(season, transfers);
});
