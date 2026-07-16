import { parsePlayerTable } from "@/lib/transfermarkt";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { parseMarketValue } from "@/lib/parse-market-value";
import { BASE_URL } from "@/lib/constants";
import { withSlot, setMaxConcurrent } from "@/lib/fetch";
import { tmFetch } from "@/lib/tm-relay";
import type { MarketValueMover, MarketValueMoversResult } from "@/app/types";

setMaxConcurrent(3);

const AJAX_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
  Accept: "*/*",
  "X-Requested-With": "XMLHttpRequest",
  "sec-ch-ua-platform": '"macOS"',
  "sec-ch-ua": '"Chromium";v="145", "Not:A-Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
};

const MAX_RETRIES = 5;
const BASE_DELAY = 1000;
const LOOKBACK_YEARS = 7;

type Direction = "losers" | "winners";

interface DirectionConfig {
  urlPath: string;
  sortParam: string;
  label: string;
  outFile: string;
}

const DIRECTION_CONFIG: Record<Direction, DirectionConfig> = {
  losers: {
    urlPath: "marktwertverluste",
    sortParam: "aenderung",
    label: "biggest-losers",
    outFile: "biggest-losers.json",
  },
  winners: {
    urlPath: "marktwertspruenge",
    sortParam: "aenderung.desc",
    label: "biggest-winners",
    outFile: "biggest-winners.json",
  },
};

function buildUrl(date: string, cfg: DirectionConfig): string {
  return `${BASE_URL}/spieler-statistik/${cfg.urlPath}/marktwertetop/plus/ajax/yw1/datum/${date}/ausrichtung/alle/spielerposition_id//altersklasse/alle/land_id/0/yt0/Show/0//sort/${cfg.sortParam}?ajax=yw1`;
}

function buildReferer(date: string, cfg: DirectionConfig): string {
  return `${BASE_URL}/spieler-statistik/${cfg.urlPath}/marktwertetop/plus/0/galerie/0?datum=${date}&ausrichtung=alle&spielerposition_id=&altersklasse=alle&land_id=0&yt0=Show`;
}

async function fetchWithRetry(url: string, referer: string, label: string): Promise<string> {
  return withSlot(async () => {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const response = await tmFetch(url, {
        headers: { ...AJAX_HEADERS, Referer: referer },
      });
      if (!response.ok) {
        console.warn(`[${label}] HTTP ${response.status}, retry ${attempt + 1}/${MAX_RETRIES}`);
      } else {
        const html = await response.text();
        if (html.length > 500) return html;
        console.warn(
          `[${label}] Rate limited (${html.length}b), retry ${attempt + 1}/${MAX_RETRIES}`,
        );
      }
      if (attempt < MAX_RETRIES - 1) {
        // Per-request jitter so retries don't burst in lockstep across periods
        const jitter = Math.random() * BASE_DELAY * 2 ** attempt;
        await new Promise((r) => setTimeout(r, BASE_DELAY * 2 ** attempt + jitter));
      }
    }
    throw new Error(`[${label}] Failed after ${MAX_RETRIES} retries: ${url}`);
  });
}

function parsePeriodMovers(html: string, date: string): MarketValueMover[] {
  return parsePlayerTable(
    html,
    (player, row) => {
      const prevMatch = row.attr(5, "span", "title").match(/€[\d.]+\s*(bn|m|k)?/i);
      const previousValue = prevMatch ? parseMarketValue(prevMatch[0]) : 0;
      if (!player.name || !player.playerId || previousValue <= 0) return null;
      return {
        name: player.name,
        position: player.position,
        age: parseInt(row.text(4), 10) || 0,
        club: row.link(2).title,
        clubLogoUrl: row.image(2),
        nationality: row.imageTitle(3),
        currentValue: parseMarketValue(
          row
            .text(5)
            .replace(/\u00a0/g, "")
            .trim(),
        ),
        previousValue,
        absoluteChange: parseMarketValue(row.text(7).replace(/[+-]/g, "")),
        relativeChange: Math.abs(parseFloat(row.text(6).replace(/[^0-9.]/g, "")) || 0),
        imageUrl: player.imageUrl,
        profileUrl: `${BASE_URL}${player.profileUrl}`,
        playerId: player.playerId,
        period: date,
      };
    },
    { playerColumn: 1 },
  );
}

function selectPeriodMovers(players: MarketValueMover[]): MarketValueMover[] {
  if (players.length === 0) return [];

  const sorted = [...players].sort((a, b) => b.absoluteChange - a.absoluteChange);
  const selected: MarketValueMover[] = [sorted[0]];
  let highestRelPct = sorted[0].relativeChange;

  let i = 1;
  while (i < sorted.length) {
    const tierVal = sorted[i].absoluteChange;
    const tier: MarketValueMover[] = [];
    while (i < sorted.length && sorted[i].absoluteChange === tierVal) {
      tier.push(sorted[i]);
      i++;
    }
    const qualifying = tier.filter((p) => p.relativeChange > highestRelPct);
    if (qualifying.length === 0) break;

    selected.push(...qualifying);
    highestRelPct = Math.max(...qualifying.map((p) => p.relativeChange));
  }

  return selected;
}

function getPeriodDates(): string[] {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() >= 6 ? 6 : 0, 1);
  const stop = new Date(start.getFullYear() - LOOKBACK_YEARS, start.getMonth(), 1);

  const dates: string[] = [];
  for (let d = new Date(start); d >= stop; d.setMonth(d.getMonth() - 6)) {
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
  }
  return dates;
}

async function fetchAllPeriods(
  dates: string[],
  cfg: DirectionConfig,
): Promise<Map<string, MarketValueMover[]>> {
  const results = await Promise.allSettled(
    dates.map((d) =>
      fetchWithRetry(buildUrl(d, cfg), buildReferer(d, cfg), cfg.label).then((html) =>
        parsePeriodMovers(html, d),
      ),
    ),
  );
  const map = new Map<string, MarketValueMover[]>();
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      if (r.value.length === 0) {
        console.warn(`[${cfg.label}] ${dates[i]}: fetched OK but parsed 0 players`);
      }
      map.set(dates[i], r.value);
    } else {
      console.warn(`[${cfg.label}] ${dates[i]}: ${r.reason}`);
    }
  });
  return map;
}

async function processDirection(direction: Direction): Promise<void> {
  const cfg = DIRECTION_CONFIG[direction];
  const allDates = getPeriodDates();
  console.log(
    `[${cfg.label}] Fetching ${allDates.length} periods: ${allDates[0]} → ${allDates.at(-1)}`,
  );

  const periodResults = await fetchAllPeriods(allDates, cfg);
  const processedPeriods: { date: string; movers: MarketValueMover[] }[] = [];
  const moversByPlayer = new Map<string, MarketValueMover[]>();

  for (const date of allDates) {
    const allPlayers = periodResults.get(date);
    if (!allPlayers || allPlayers.length === 0) continue;
    const movers = selectPeriodMovers(allPlayers);
    processedPeriods.push({ date, movers });
    console.log(`[${cfg.label}] ${date}: ${allPlayers.length} players → ${movers.length} selected`);

    for (const mover of movers) {
      const existing = moversByPlayer.get(mover.playerId) || [];
      existing.push(mover);
      moversByPlayer.set(mover.playerId, existing);
    }
  }

  const repeats = [...moversByPlayer.values()].filter((a) => a.length >= 2);
  console.log(
    `[${cfg.label}] ${repeats.length} repeat(s) across ${processedPeriods.length} periods`,
  );
  // Refuse to write a stub file — better to keep yesterday's data than push empty JSON to prod
  if (processedPeriods.length === 0) {
    throw new Error(
      `[${cfg.label}] All ${allDates.length} period fetches failed — refusing to overwrite ${cfg.outFile} with empty data`,
    );
  }
  await writeResult({ repeatMovers: repeats, periods: processedPeriods }, cfg);
}

async function writeResult(result: MarketValueMoversResult, cfg: DirectionConfig) {
  const outDir = join(process.cwd(), "data");
  const outPath = join(outDir, cfg.outFile);
  await mkdir(outDir, { recursive: true });
  await writeFile(outPath, JSON.stringify(result));
  console.log(`[${cfg.label}] Wrote ${outPath}`);
}

async function main() {
  await Promise.all([processDirection("losers"), processDirection("winners")]);
  const tsPath = join(process.cwd(), "data", "biggest-movers-updated-at.txt");
  await writeFile(tsPath, new Date().toISOString());
  console.log("[biggest-movers] Done");
}

main().catch((err) => {
  console.error("[biggest-movers] Fatal error:", err);
  process.exit(1);
});
