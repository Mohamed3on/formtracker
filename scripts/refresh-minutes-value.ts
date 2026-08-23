import { writeFile, readFile, mkdir } from "fs/promises";
import { join } from "path";
import {
  fetchMinutesValueRaw,
  fetchO30MostValuableRaw,
  fetchTopForwardsRaw,
} from "@/lib/fetch-minutes-value";
import { fetchTopScorersRaw, fetchYearlyScorersRaw } from "@/lib/fetch-top-scorers";
import { fetchPlayerMinutesRaw } from "@/lib/fetch-player-minutes";
import {
  reaggregatePlayerStats,
  tmCurrentSeasonId,
  type ClubTypes,
  type PlayerStatsResult,
} from "@/lib/player-aggregation";
import { chooseSeason } from "@/lib/season-selection";
import { extractClubIdFromLogoUrl } from "@/lib/format";
import { crestUrl, flagUrl } from "@/lib/transfermarkt/image";
import { fetchClubTypes } from "@/lib/alpha-clubs";
import { fetchPage, setMaxConcurrent } from "@/lib/fetch";
import { BASE_URL } from "@/lib/constants";
import {
  analyzeMinutesRegressions,
  MINUTES_DROP_TOLERANCE,
  sampleRegressionDrops,
} from "@/lib/minutes-regression";
import type { MinutesValuePlayer } from "@/app/types";

const FORCE_REFRESH = process.argv.includes("--force") || process.env.FORCE_REFRESH === "1";
const CONCURRENCY = { max: 40, min: 10 };
const DELAY = { base: 100, multiplier: 2 };
const FAILURE_THRESHOLD = 0.3;
const CLEAN_BATCHES_TO_RAMP = 3;
const MAX_RETRY_ROUNDS = 8;

const DATA_DIR = join(process.cwd(), "data");
const OUT_PATH = join(DATA_DIR, "minutes-value.json");
const CACHE_PATH = join(DATA_DIR, "player-cache.json");
const CLUBS_PATH = join(DATA_DIR, "clubs.json");
const CLUB_TYPES_PATH = join(DATA_DIR, "club-types.json");
// MV-based lists (most valuable, O30, top forwards) only move on TM's value
// update cycles — cache for a day. Scorer lists change after every match so we
// always try to refresh them per run, with the cached version as fallback for
// WAF blocks.
const POOL_MV_PATH = join(DATA_DIR, "player-pool-mv.json");
const POOL_MV_TS_PATH = join(DATA_DIR, "player-pool-mv-updated-at.txt");
const POOL_MV_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const POOL_SCORERS_PATH = join(DATA_DIR, "player-pool-scorers.json");
// The TM season the committed data was aggregated for. Written on every
// successful run; a change between runs marks a deliberate season flip.
const SEASON_PATH = join(DATA_DIR, "season.txt");

type CacheEntry = { data: PlayerStatsResult; fetchedAt: number };
type Cache = Record<string, CacheEntry>;
type ClubMap = Record<string, { name: string; logoUrl: string }>;
// Discard cache entries older than this. Default 12h; STALE_HOURS env can override (e.g. button-triggered refresh uses 1h).
const STALE_MAX_MS = process.env.STALE_HOURS
  ? Number(process.env.STALE_HOURS) * 60 * 60 * 1000
  : 12 * 60 * 60 * 1000;

// --- 1. Gather & dedupe player pool ---

async function fetchMVWithRetry(maxAttempts = 6): Promise<MinutesValuePlayer[]> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fetchMinutesValueRaw();
      if (result.length > 0) return result;
      console.warn(`[refresh] MV pages returned 0 (attempt ${attempt}/${maxAttempts})`);
    } catch (e) {
      console.warn(`[refresh] MV pages failed (attempt ${attempt}/${maxAttempts}): ${e}`);
    }
    if (attempt < maxAttempts) {
      const delay = Math.min(120_000, 10_000 * 2 ** (attempt - 1));
      console.warn(`[refresh] Waiting ${delay / 1000}s before retry...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return [];
}

function dedupeById(groups: { label: string; list: MinutesValuePlayer[] }[]): MinutesValuePlayer[] {
  const seen = new Set<string>();
  const players: MinutesValuePlayer[] = [];
  for (const { label, list } of groups) {
    let added = 0;
    for (const p of list) {
      if (!seen.has(p.playerId)) {
        seen.add(p.playerId);
        players.push(p);
        added++;
      }
    }
    console.log(`[refresh] ${label}: +${added} new (${list.length} total)`);
  }
  return players;
}

async function gatherMvPool(): Promise<MinutesValuePlayer[]> {
  console.log("[refresh] Fetching MV-based pool (most valuable, O30, top forwards)...");
  const [mvPlayers, o30Players, topForwards] = await Promise.all([
    fetchMVWithRetry(),
    fetchO30MostValuableRaw().catch(() => [] as MinutesValuePlayer[]),
    fetchTopForwardsRaw().catch(() => [] as MinutesValuePlayer[]),
  ]);
  if (mvPlayers.length === 0) {
    throw new Error("0 players from MV pages after 6 attempts — rate-limited.");
  }
  if (o30Players.length === 0) console.warn("[refresh] O30 MV unavailable — continuing without");
  if (topForwards.length === 0)
    console.warn("[refresh] top forwards unavailable — continuing without");
  return dedupeById([
    { label: "MV", list: mvPlayers },
    { label: "O30 MV", list: o30Players },
    { label: "top forwards", list: topForwards },
  ]);
}

async function gatherScorerPool(seasonId: number): Promise<MinutesValuePlayer[]> {
  console.log(`[refresh] Fetching scorer pool (season ${seasonId} + yearly)...`);
  const [seasonScorers, yearlyScorers] = await Promise.all([
    fetchTopScorersRaw(seasonId).catch(() => [] as MinutesValuePlayer[]),
    fetchYearlyScorersRaw().catch(() => [] as MinutesValuePlayer[]),
  ]);
  if (seasonScorers.length === 0)
    console.warn("[refresh] season scorers unavailable — continuing without");
  if (yearlyScorers.length === 0)
    console.warn("[refresh] yearly scorers unavailable — continuing without");
  if (seasonScorers.length === 0 && yearlyScorers.length === 0) {
    throw new Error("both scorer lists unavailable");
  }
  return dedupeById([
    { label: "season scorers", list: seasonScorers },
    { label: "yearly scorers", list: yearlyScorers },
  ]);
}

/** MV pool: reuse if < 24h old, otherwise regather. Fall back to cache on failure. */
async function loadMvPool(): Promise<MinutesValuePlayer[]> {
  let cached: MinutesValuePlayer[] | null = null;
  let ageMs = Infinity;
  try {
    cached = JSON.parse(await readFile(POOL_MV_PATH, "utf-8"));
    ageMs = Date.now() - new Date((await readFile(POOL_MV_TS_PATH, "utf-8")).trim()).getTime();
  } catch {}
  if (!FORCE_REFRESH && cached && ageMs < POOL_MV_MAX_AGE_MS) {
    console.log(
      `[refresh] Reusing MV pool: ${cached.length} players (${(ageMs / 3.6e6).toFixed(1)}h old)`,
    );
    return cached;
  }
  try {
    const players = await gatherMvPool();
    await writeFile(POOL_MV_PATH, JSON.stringify(players));
    await writeFile(POOL_MV_TS_PATH, new Date().toISOString());
    return players;
  } catch (e) {
    if (cached) {
      console.warn(
        `[refresh] MV gather failed, using ${(ageMs / 3.6e6).toFixed(1)}h-old cache: ${e}`,
      );
      return cached;
    }
    throw e;
  }
}

/** Scorer pool: always attempt fetch (values change per match). Cache is fallback-only. */
async function loadScorerPool(seasonId: number): Promise<MinutesValuePlayer[]> {
  let cached: MinutesValuePlayer[] | null = null;
  try {
    cached = JSON.parse(await readFile(POOL_SCORERS_PATH, "utf-8"));
  } catch {}
  try {
    const players = await gatherScorerPool(seasonId);
    await writeFile(POOL_SCORERS_PATH, JSON.stringify(players));
    return players;
  } catch (e) {
    if (cached) {
      console.warn(`[refresh] Scorer gather failed, using cached scorer pool: ${e}`);
      return cached;
    }
    console.warn(`[refresh] Scorer gather failed and no cache available: ${e}`);
    return [];
  }
}

// --- 2. Fetch per-player stats with adaptive concurrency ---

type FetchState = { staleCache: Cache; cache: Cache };

/** Load the previous runs' player cache once. Valid entries serve as fetch
 *  fallback across all fetch phases. */
async function loadCacheState(): Promise<FetchState> {
  const now = Date.now();
  const staleCache: Cache = {};
  try {
    const raw: Cache = JSON.parse(await readFile(CACHE_PATH, "utf-8"));
    // Discard entries older than STALE_MAX_MS, and treat zero-stats+empty-league entries
    // as corrupted (previous failure mode where a failed CEAPI silently cached zeros).
    for (const [id, entry] of Object.entries(raw)) {
      const s = entry.data;
      const looksCorrupted = !s.league && !s.appearances && !s.minutes && !s.goals && !s.assists;
      if (entry.fetchedAt && now - entry.fetchedAt < STALE_MAX_MS && !looksCorrupted) {
        staleCache[id] = entry;
      }
    }
    console.log(
      `[refresh] Loaded ${Object.keys(staleCache).length} valid cache entries (${Object.keys(raw).length - Object.keys(staleCache).length} expired)`,
    );
  } catch {
    // No cache available
  }
  console.log(
    `[refresh] TM_RELAY_URL: ${process.env.TM_RELAY_URL ? "set — fetching via relay" : "NOT SET — fetching direct"}`,
  );
  return { staleCache, cache: {} };
}

/** Fetch stats for the given players into `fetchState.cache` (cumulative across
 *  calls — the pipeline runs one phase for the MV pool, then one for the
 *  scorer-pool delta once the season is known). */
async function fetchStats(
  fetchState: FetchState,
  playerIds: string[],
  clubTypes: ClubTypes,
): Promise<void> {
  const { staleCache, cache } = fetchState;
  const now = Date.now();
  if (FORCE_REFRESH) {
    console.log("[refresh] --force: bypassing cache, fetching all players");
  } else {
    for (const id of playerIds) {
      if (staleCache[id]) cache[id] = staleCache[id];
    }
  }
  let remaining = playerIds.filter((id) => !cache[id]);
  console.log(
    `[refresh] ${playerIds.length - remaining.length} players served from cache, ${remaining.length} need fetching`,
  );

  for (let round = 0; round <= MAX_RETRY_ROUNDS && remaining.length > 0; round++) {
    if (round > 0) console.log(`[refresh] Retry ${round}: ${remaining.length} remaining`);

    const state = {
      concurrency: round === 0 ? CONCURRENCY.max : CONCURRENCY.min,
      delay: DELAY.base * (round === 0 ? 1 : 2 ** round),
      cleanStreak: 0,
    };
    const failed: string[] = [];

    for (let i = 0; i < remaining.length; i += state.concurrency) {
      const batch = remaining.slice(i, i + state.concurrency);
      const results = await Promise.allSettled(
        batch.map((id) => fetchPlayerMinutesRaw(id, clubTypes)),
      );

      let failures = 0;
      for (let j = 0; j < batch.length; j++) {
        const r = results[j];
        if (r.status === "fulfilled") cache[batch[j]] = { data: r.value, fetchedAt: now };
        else {
          failures++;
          failed.push(batch[j]);
        }
      }

      const failRate = failures / batch.length;
      if (failRate > FAILURE_THRESHOLD && state.concurrency > CONCURRENCY.min) {
        state.concurrency = Math.max(CONCURRENCY.min, state.concurrency >> 1);
        state.delay *= DELAY.multiplier;
        state.cleanStreak = 0;
      } else if (
        failures === 0 &&
        ++state.cleanStreak >= CLEAN_BATCHES_TO_RAMP &&
        state.concurrency < CONCURRENCY.max
      ) {
        state.concurrency = Math.min(CONCURRENCY.max, state.concurrency * 2);
        state.delay = Math.max(DELAY.base, state.delay >> 1);
        state.cleanStreak = 0;
      } else if (failures > 0) {
        state.cleanStreak = 0;
      }

      const done = playerIds.filter((id) => cache[id]).length;
      console.log(
        `[refresh] ${done}/${playerIds.length} fetched (batch: ${batch.length - failures}/${batch.length} ok)`,
      );

      if (i + state.concurrency < remaining.length) {
        await new Promise((r) => setTimeout(r, state.delay));
      }
    }
    // Persist once per retry round, not per batch: the serialized cache is
    // ~800 MB, and per-batch writes meant ~34 full re-serializations a run.
    if (failed.length < remaining.length) {
      await writeFile(CACHE_PATH, JSON.stringify({ ...staleCache, ...cache }));
    }
    remaining = failed;
  }

  if (remaining.length > 0) {
    let filled = 0;
    const uncached: string[] = [];
    for (const id of remaining) {
      if (staleCache[id]) {
        cache[id] = staleCache[id];
        filled++;
      } else {
        uncached.push(id);
      }
    }
    if (filled > 0) {
      console.log(`[refresh] ${filled} failed players filled from previous cache`);
      await writeFile(CACHE_PATH, JSON.stringify({ ...staleCache, ...cache }));
    }
    if (uncached.length > 5) {
      throw new Error(
        `${uncached.length} players failed with no cached fallback after ${MAX_RETRY_ROUNDS} rounds — too many`,
      );
    }
    if (uncached.length > 0) {
      console.warn(
        `[refresh] ${uncached.length} players have no data at all — skipping: ${uncached.join(", ")}`,
      );
    }
  }
}

// --- 3. Merge fetched stats into player objects ---

function mergeStats(players: MinutesValuePlayer[], cache: Cache): void {
  for (const p of players) {
    const entry = cache[p.playerId];
    if (!entry) continue;
    const s = entry.data;

    p.fetchedAt = entry.fetchedAt;
    p.minutes = s.minutes;
    p.totalMatches = s.appearances || p.totalMatches;
    p.goals = s.goals;
    p.assists = s.assists;
    p.penaltyGoals = s.penaltyGoals;
    p.penaltyMisses = s.penaltyMisses;
    p.intlGoals = s.intlGoals;
    p.intlAssists = s.intlAssists;
    p.intlMinutes = s.intlMinutes;
    p.intlAppearances = s.intlAppearances;
    p.intlPenaltyGoals = s.intlPenaltyGoals;
    p.intlCareerCaps = s.intlCareerCaps;
    p.gamesMissed = s.gamesMissed;
    p.totalGames = s.totalGames;

    if (s.club) p.club = s.club;
    if (s.clubLogoUrl) p.clubLogoUrl = s.clubLogoUrl;
    if (s.league) p.league = s.league;
    if (s.nationality) p.nationality = s.nationality;
    if (s.nationalityFlagUrl) p.nationalityFlagUrl = s.nationalityFlagUrl;
    if (s.leagueLogoUrl) p.leagueLogoUrl = s.leagueLogoUrl;
    if (s.contractExpiry) p.contractExpiry = s.contractExpiry;
    if (s.playedPosition) p.playedPosition = s.playedPosition;
    if (s.recentForm?.length) p.recentForm = s.recentForm;
    if (s.positionStats?.length) p.positionStats = s.positionStats;
    if (s.marketValue) {
      p.marketValue = s.marketValue;
      p.marketValueDisplay = s.marketValueDisplay;
    }
    if (s.age) p.age = s.age;

    if (s.isCurrentIntl) {
      p.isCurrentIntl = true;
    } else {
      delete p.isCurrentIntl;
    }
    if (s.isNewSigning) {
      p.isNewSigning = true;
    } else {
      delete p.isNewSigning;
    }
    if (s.isOnLoan) {
      p.isOnLoan = true;
    } else {
      delete p.isOnLoan;
    }
  }
}

// --- 4. Club map: build from player data + scrape unknowns ---

async function loadClubMap(): Promise<ClubMap> {
  try {
    return JSON.parse(await readFile(CLUBS_PATH, "utf-8")) as ClubMap;
  } catch {
    return {};
  }
}

function seedClubMapFromPlayers(players: MinutesValuePlayer[], clubs: ClubMap): void {
  for (const p of players) {
    const id = extractClubIdFromLogoUrl(p.clubLogoUrl);
    if (id && p.club && !clubs[id]) {
      clubs[id] = { name: p.club, logoUrl: crestUrl(id) };
    }
  }
}

async function scrapeClub(clubId: string): Promise<{ name: string; logoUrl: string } | null> {
  try {
    const html = await fetchPage(`${BASE_URL}/x/datenfakten/verein/${clubId}`);
    const name = html
      .match(/<title>([^<]+)/)?.[1]
      .replace(/ - .*/, "")
      .trim();
    if (!name) return null;
    // National teams render a flag header (flagge/begegnungslider/{landId}); their
    // wappen/head crest is an empty image, so use the country flag instead.
    const landId = html.match(/flagge\/begegnungslider\/(\d+)\.png/)?.[1];
    return { name, logoUrl: landId ? flagUrl(landId) : crestUrl(clubId) };
  } catch {
    return null;
  }
}

async function resolveUnknownClubs(players: MinutesValuePlayer[], clubs: ClubMap): Promise<void> {
  // Only resolve opponents from recentForm (last 10 games per player)
  const unknown = new Set<string>();
  for (const p of players) {
    for (const m of p.recentForm ?? []) {
      if (m.opponentClubId && !clubs[m.opponentClubId]) unknown.add(m.opponentClubId);
    }
  }
  if (unknown.size === 0) return;

  console.log(`[refresh] Resolving ${unknown.size} unknown opponent clubs...`);
  const ids = [...unknown];
  const BATCH = 10;
  let resolved = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map((id) => scrapeClub(id)));
    for (let j = 0; j < batch.length; j++) {
      const r = results[j];
      const club = r.status === "fulfilled" ? r.value : null;
      clubs[batch[j]] = club ?? { name: `Club ${batch[j]}`, logoUrl: crestUrl(batch[j]) };
      if (club) resolved++;
    }
    if (i + BATCH < ids.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  console.log(`[refresh] Resolved ${resolved}/${unknown.size} club names`);
}

function enrichRecentForm(players: MinutesValuePlayer[], clubs: ClubMap): void {
  for (const p of players) {
    if (!p.recentForm) continue;
    for (const m of p.recentForm) {
      if (m.opponentClubId && !m.opponentName) {
        const club = clubs[m.opponentClubId];
        if (club) {
          m.opponentName = club.name;
          m.opponentLogoUrl = club.logoUrl;
        }
      }
    }
  }
}

// --- 5. Season selection ---

async function readSeasonMarker(): Promise<number | null> {
  try {
    const n = Number((await readFile(SEASON_PATH, "utf-8")).trim());
    return Number.isFinite(n) && n > 2000 ? n : null;
  } catch {
    return null;
  }
}

// --- 6. Validate ---

async function validate(players: MinutesValuePlayer[], seasonChanged: boolean): Promise<void> {
  const fetched = players.filter((p) => p.fetchedAt);
  const zeroStats = fetched.filter((p) => p.goals === 0 && p.assists === 0 && p.minutes === 0);
  const zeroMV = players.filter((p) => p.marketValue <= 0);
  console.log(
    `[refresh] Validation: ${zeroStats.length}/${fetched.length} zero-stats, ${zeroMV.length}/${players.length} zero-MV`,
  );
  // Aggregation-bug backstop: even right after an early season flip (~35%
  // coverage) zero-stats can't legitimately exceed ~65%. Near-total zeros mean
  // aggregation broke (e.g. corrupted clubTypes) despite healthy rawGames —
  // the season-coverage guard upstream can't see that.
  if (fetched.length > 50 && zeroStats.length / fetched.length > 0.8) {
    throw new Error(
      `${zeroStats.length}/${fetched.length} players aggregated to zero stats despite healthy payloads — aggregation bug.`,
    );
  }
  if (zeroMV.length > players.length * 0.1) {
    throw new Error(
      `${zeroMV.length}/${players.length} players have no market value — scraping issue.`,
    );
  }

  // A deliberate season flip resets every stat; comparing against the old
  // season's file would only produce false alarms.
  if (seasonChanged) {
    console.log("[refresh] Season flipped — skipping old-vs-new regression checks this run.");
    return;
  }

  try {
    const existing: MinutesValuePlayer[] = JSON.parse(await readFile(OUT_PATH, "utf-8"));
    const oldGA = existing.reduce((s, p) => s + p.goals + p.assists, 0);
    const newGA = players.reduce((s, p) => s + p.goals + p.assists, 0);
    const oldCount = existing.length;
    const newCount = players.filter((p) => p.marketValue > 0).length;
    console.log(
      `[refresh] G+A: ${oldGA} → ${newGA} (${newGA >= oldGA ? "+" : ""}${newGA - oldGA}), players: ${oldCount} → ${newCount} (${newCount >= oldCount ? "+" : ""}${newCount - oldCount})`,
    );
    if (oldGA > 100 && newGA < oldGA * 0.85) {
      throw new Error(
        `Stats regressed: G+A ${oldGA} → ${newGA} (${Math.round((newGA / oldGA) * 100)}%).`,
      );
    }
    if (oldCount > 100 && newCount < oldCount * 0.85) {
      throw new Error(
        `Player count regressed: ${oldCount} → ${newCount} (${Math.round((newCount / oldCount) * 100)}%).`,
      );
    }
    // Per-player regression: tolerate small minute drops, whole-club corrections
    // (TM voids/postpones a match → every club player loses ~90'), and a small
    // number of scattered drops (individual stat tweaks). Fail only on a wide
    // wave that suggests the scrape itself broke.
    const report = analyzeMinutesRegressions(existing, players);
    if (report.ignoredClubs.length > 0) {
      console.warn(
        `[refresh] Ignoring whole-club corrections (likely match void/postpone): ${report.ignoredClubs.join(", ")} — ${report.ignoredCount} players`,
      );
    }
    if (report.fail) {
      const msg = `${report.scattered.length} player(s) regressed >${MINUTES_DROP_TOLERANCE}' (tolerance ${report.maxScattered}, e.g. ${sampleRegressionDrops(existing, report.scattered)}) — scrape regressed silently.`;
      // Escape hatch for intentional aggregation changes (e.g. tightening the
      // first-team filter). Keep narrow: only honor when explicitly opted in.
      if (process.env.SKIP_MINUTES_REGRESSION === "1") {
        console.warn(`[refresh] SKIP_MINUTES_REGRESSION=1 — tolerating: ${msg}`);
      } else {
        throw new Error(msg);
      }
    }
    if (report.scattered.length > 0) {
      console.warn(
        `[refresh] ${report.scattered.length} scattered minute drops within tolerance ${report.maxScattered}: ${sampleRegressionDrops(existing, report.scattered)}`,
      );
    }
  } catch (e) {
    if (
      e instanceof Error &&
      (e.message.startsWith("Stats regressed") ||
        e.message.startsWith("Player count") ||
        e.message.includes("regressed >"))
    )
      throw e;
  }
}

// --- Club types ---

async function loadClubTypes(): Promise<ClubTypes> {
  try {
    return JSON.parse(await readFile(CLUB_TYPES_PATH, "utf-8")) as ClubTypes;
  } catch {
    return {};
  }
}

/** Resolve any clubIds in the cache that aren't yet in `clubTypes` and merge
 *  the results in. Returns the set of newly-resolved IDs so callers can scope
 *  re-aggregation to only the players that referenced them. */
async function enrichClubTypes(cache: Cache, clubTypes: ClubTypes): Promise<Set<string>> {
  const unknown = new Set<string>();
  for (const entry of Object.values(cache)) {
    for (const g of entry.data.rawGames ?? []) {
      const id = g.clubsInformation?.club?.clubId;
      if (id && !(id in clubTypes)) unknown.add(id);
    }
  }
  if (unknown.size === 0) return new Set();
  const ids = [...unknown];
  console.log(`[refresh] Resolving ${ids.length} unknown clubTypeIds from alpha API...`);
  const resolvedMap = await fetchClubTypes(ids, (msg) => console.warn(`[refresh] ${msg}`));
  const resolved = new Set<string>();
  for (const [id, t] of Object.entries(resolvedMap)) {
    clubTypes[id] = t;
    resolved.add(id);
  }
  console.log(`[refresh] clubTypes resolved ${resolved.size}/${ids.length}`);
  return resolved;
}

async function saveClubTypes(clubTypes: ClubTypes): Promise<void> {
  const sorted = Object.fromEntries(
    Object.entries(clubTypes).sort(([a], [b]) => Number(a) - Number(b)),
  );
  await writeFile(CLUB_TYPES_PATH, JSON.stringify(sorted, null, 2) + "\n");
}

// --- Main pipeline ---

async function main() {
  // Batch script with its own adaptive backoff — raise the shared TM limit here
  // (inside main, never at module scope: import order must not decide the limit).
  setMaxConcurrent(CONCURRENCY.max);
  const markerSeason = await readSeasonMarker();
  const [mvList, clubTypes, fetchState] = await Promise.all([
    loadMvPool(),
    loadClubTypes(),
    loadCacheState(),
  ]);
  const mvIds = new Set(mvList.map((p) => p.playerId));
  const mvPlayerIds = mvList.map((p) => p.playerId);

  // Phase 1: the MV pool is season-agnostic, so its stats can be fetched
  // before the season is known — and 500+ top-flight players are a fully
  // representative sample for the season decision.
  console.log(`[refresh] Phase 1: fetching stats for ${mvPlayerIds.length} MV-pool players...`);
  await fetchStats(fetchState, mvPlayerIds, clubTypes);

  const season = chooseSeason(fetchState.cache, mvPlayerIds, tmCurrentSeasonId());
  const seasonChanged = markerSeason !== null && markerSeason !== season;
  console.log(
    `[refresh] Aggregating season ${season}${seasonChanged ? ` (flipped from ${markerSeason})` : ""}`,
  );

  // Phase 2: the scorer pool is season-scoped, so it's gathered for the chosen
  // season and only its players not already covered by the MV pool are fetched.
  const scorerList = await loadScorerPool(season);
  const players = dedupeById([
    { label: "MV pool", list: mvList },
    { label: "scorer pool", list: scorerList },
  ]);
  if (players.length < 100) {
    throw new Error(`Only ${players.length} players — expected 100+.`);
  }
  const scorerOnlyIds = players.map((p) => p.playerId).filter((id) => !mvIds.has(id));
  console.log(
    `[refresh] Phase 2: fetching stats for ${scorerOnlyIds.length} scorer-only players...`,
  );
  await fetchStats(fetchState, scorerOnlyIds, clubTypes);
  const cache = fetchState.cache;

  const newlyResolved = await enrichClubTypes(cache, clubTypes);
  if (newlyResolved.size > 0) await saveClubTypes(clubTypes);

  // Re-aggregate every entry for the chosen season: fetch-time aggregates used
  // the date-based candidate (and possibly stale clubTypes), and cached entries
  // may predate a season flip entirely. rawGames make this a local recompute.
  for (const entry of Object.values(cache)) {
    entry.data = reaggregatePlayerStats(entry.data, clubTypes, season);
  }

  mergeStats(players, cache);

  // Build club map and enrich recentForm with opponent names/logos
  const clubs = await loadClubMap();
  seedClubMapFromPlayers(players, clubs);
  await resolveUnknownClubs(players, clubs);
  enrichRecentForm(players, clubs);

  await validate(players, seasonChanged);

  // Scorer-pool players earn their slot via goals, so only top-flight ones count:
  // a winter signing's 2nd-division (or reserve-team) tally shouldn't read as a
  // top-5 scoring record. MV-pool players are notable on value alone, so all their
  // goals stand. (e.g. Arévalo's 13 "goals" were LaLiga2 + Stuttgart II, 0 Bundesliga.)
  // Every entry was re-aggregated for the chosen season above, so topFlightGoals
  // is current. No rawGames → leave goals as-is (no-MV, filtered below).
  for (const p of players) {
    if (mvIds.has(p.playerId)) continue;
    const entry = cache[p.playerId];
    if (entry?.data.rawGames?.length) {
      p.goals = entry.data.topFlightGoals;
    }
  }
  const withMV = players.filter(
    (p) => p.marketValue > 0 && (mvIds.has(p.playerId) || p.goals >= 1),
  );
  const noMv = players.filter((p) => p.marketValue <= 0).length;
  console.log(
    `[refresh] Filtered ${players.length - withMV.length} (${noMv} no market value, rest scorer-pool with no top-flight goal)`,
  );

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(CLUBS_PATH, JSON.stringify(clubs));
  await writeFile(OUT_PATH, JSON.stringify(withMV));
  await writeFile(SEASON_PATH, `${season}\n`);
  await writeFile(join(DATA_DIR, "updated-at.txt"), new Date().toISOString());
  console.log(
    `[refresh] Done: ${withMV.length} players (season ${season}) → ${OUT_PATH}, ${Object.keys(clubs).length} clubs cached`,
  );
}

main().catch((err) => {
  console.error("[refresh] Fatal:", err);
  process.exit(1);
});
