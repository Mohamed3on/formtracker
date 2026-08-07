import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cache } from "react";
import type { ManagerInfo } from "@/app/types";

/** Managers for the nations that finished off their value seeding, frozen at
 *  tournament end by scripts/snapshot-wc.ts. Replaces what used to be the
 *  repo's biggest prerender cost: ~2 live scrapes per comparable manager,
 *  ~140 requests per /wc-live build. */
export const getWcManagers = cache(async (): Promise<Record<string, ManagerInfo>> => {
  try {
    return JSON.parse(await readFile(join(process.cwd(), "data", "wc", "managers.json"), "utf-8"));
  } catch (err) {
    console.error("[wc] missing managers snapshot:", err);
    return {};
  }
});
