import { readFile } from "fs/promises";
import { join } from "path";
import { cache } from "react";
import type { TransferBalanceResult } from "@/app/types";

/** Plain per-request read, deduped with React cache. data/transfer-balance.json only
 *  changes via a data-refresh deploy, so an unstable_cache could only serve it stale. */
export const getTransferBalance = cache(async (): Promise<TransferBalanceResult> => {
  const raw = await readFile(join(process.cwd(), "data", "transfer-balance.json"), "utf-8");
  return JSON.parse(raw) as TransferBalanceResult;
});
