/** Shared helper for resolving alpha-API `clubTypeId` lookups. Used by the
 *  refresh scripts to populate data/club-types.json and data/national-teams.json. */

const ALPHA_CLUBS_API = "https://tmapi-alpha.transfermarkt.technology/clubs";
const ALPHA_CLUBS_BATCH = 40;
const HEADERS = { "User-Agent": "Mozilla/5.0", Accept: "application/json" };

/** Batch-resolve clubTypeId for the given clubIds. Returns a map of
 *  clubId → clubTypeId for IDs the API responded for; missing/failed IDs are
 *  omitted. Logs HTTP failures via the optional logger. */
export async function fetchClubTypes(
  ids: string[],
  logger: (msg: string) => void = console.warn,
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (let i = 0; i < ids.length; i += ALPHA_CLUBS_BATCH) {
    const batch = ids.slice(i, i + ALPHA_CLUBS_BATCH);
    const url = `${ALPHA_CLUBS_API}?${batch.map((id) => `ids[]=${id}`).join("&")}`;
    const r = await fetch(url, { headers: HEADERS });
    if (!r.ok) {
      logger(`alpha-clubs batch ${i / ALPHA_CLUBS_BATCH}: HTTP ${r.status}`);
      continue;
    }
    const j = (await r.json()) as {
      data?: Array<{ id: string; baseDetails?: { clubTypeId?: number } }>;
    };
    for (const c of j.data ?? []) {
      if (typeof c.baseDetails?.clubTypeId === "number") out[c.id] = c.baseDetails.clubTypeId;
    }
  }
  return out;
}
