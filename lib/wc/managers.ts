import type { ManagerInfo } from "@/app/types";
import { getManagerInfo } from "@/lib/fetch-manager";
import type { TrackerRow } from "./live";
import { wcTeamTmId } from "./tm-team-links";

/**
 * Managers for the nations in the over/under table (those off their value seeding),
 * keyed by team name. National-team pages expose the same `mitarbeiterhistorie` table
 * as clubs, so `getManagerInfo` works unchanged — each scrape is cached 6h. allSettled
 * keeps one nation's failure from breaking the page.
 */
export async function getWcManagers(tracker: TrackerRow[]): Promise<Record<string, ManagerInfo>> {
  const names = tracker.filter((r) => r.projStage !== r.expStage).map((r) => r.team.name);

  const results = await Promise.allSettled(
    names.map(async (name) => {
      const id = wcTeamTmId(name);
      return id ? ([name, await getManagerInfo(String(id))] as const) : null;
    }),
  );

  const managers: Record<string, ManagerInfo> = {};
  for (const r of results) {
    if (r.status === "fulfilled" && r.value && r.value[1]) {
      managers[r.value[0]] = r.value[1];
    }
  }
  return managers;
}
