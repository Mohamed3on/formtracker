/**
 * Expands data/national-teams.json with any new national-team clubIds that have
 * appeared in the cached ceapi performance data. Runs once; future refreshes
 * pick up extra IDs only when new players from new federations enter the
 * dataset, so this is intended to be invoked ad-hoc, not on every refresh.
 */
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { fetchClubTypes } from "@/lib/alpha-clubs";
import type { CeapiGame, PlayerStatsResult } from "@/app/types";

const DATA_DIR = join(process.cwd(), "data");
const NT_PATH = join(DATA_DIR, "national-teams.json");
const CACHE_PATH = join(DATA_DIR, "player-cache.json");

type Cache = Record<string, { data: PlayerStatsResult; fetchedAt: number }>;

async function main() {
  const existing: Record<string, number> = JSON.parse(await readFile(NT_PATH, "utf8"));
  const cache: Cache = JSON.parse(await readFile(CACHE_PATH, "utf8"));

  const ntClubIds = new Set<string>();
  for (const entry of Object.values(cache)) {
    const games: CeapiGame[] | undefined = entry.data.rawGames;
    if (!games) continue;
    for (const g of games) {
      if (!g.gameInformation.isNationalGame) continue;
      const id = g.clubsInformation?.club?.clubId;
      if (id) ntClubIds.add(id);
    }
  }

  const missing = [...ntClubIds].filter((id) => !(id in existing));
  console.log(
    `existing=${Object.keys(existing).length} seen=${ntClubIds.size} missing=${missing.length}`,
  );
  if (missing.length === 0) return;

  const updated = { ...existing, ...(await fetchClubTypes(missing)) };
  const sorted = Object.fromEntries(
    Object.entries(updated).sort(([a], [b]) => Number(a) - Number(b)),
  );
  await writeFile(NT_PATH, JSON.stringify(sorted, null, 2) + "\n");
  console.log(`wrote ${Object.keys(sorted).length} entries to ${NT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
