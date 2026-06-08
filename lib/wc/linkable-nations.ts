import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Build Transfermarkt landId -> current dataset nationality name from the players
// source (/players reads the same file). The landId is stable and also embedded in
// each player's flag URL, so matching by it sidesteps name-spelling differences.
// Memoised — static committed data, read once per server process.
let byLandId: Map<number, string> | null = null;
async function nationByLandId(): Promise<Map<number, string>> {
  if (!byLandId) {
    const raw = await readFile(join(process.cwd(), "data", "minutes-value.json"), "utf-8");
    const players = JSON.parse(raw) as { nationality: string; nationalityFlagUrl: string }[];
    byLandId = new Map();
    for (const p of players) {
      const id = Number(p.nationalityFlagUrl.match(/\/(\d+)\.png/)?.[1]);
      if (id && !byLandId.has(id)) byLandId.set(id, p.nationality);
    }
  }
  return byLandId;
}

/**
 * Map of WC team name -> /players href, for teams whose nation has players there.
 * Matched by stable TM landId, so dataset spelling differences don't matter.
 */
export async function playerLinks(
  teams: { name: string; landId: number }[],
): Promise<Record<string, string>> {
  const byId = await nationByLandId();
  const out: Record<string, string> = {};
  for (const t of teams) {
    const nat = byId.get(t.landId);
    if (nat) out[t.name] = `/players?nat=${encodeURIComponent(nat)}`;
  }
  return out;
}
