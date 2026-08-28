import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { BASE_URL } from "@/lib/constants";
import { fetchPage, setMaxConcurrent } from "@/lib/fetch";
import type {
  TransferBalanceClub,
  TransferBalanceMetric,
  TransferBalanceResult,
  TransferBalanceWindow,
} from "@/app/types";

const DATA_DIR = join(process.cwd(), "data");
const LABEL = "transfer-balance";

/** How many seasons each window spans, ending at the current season. Linear, not
 *  doubling: a club topping two of four over ten years says nothing about now. */
const LADDER = [1, 2, 3, 4];

/** Transfermarkt renders ONE club table (Expenditure | Arrivals | Income | Departures |
 *  Balance) and `ids` only chooses the sort. Expenditure is the default sort, reached by
 *  omitting `ids` entirely — any unrecognised value falls back to it, so don't invent one. */
const SORTS: { metric: TransferBalanceMetric; ids?: string }[] = [
  { metric: "expenditure" },
  { metric: "income", ids: "e" },
  { metric: "netProfit", ids: "s" },
  { metric: "netSpender", ids: "d" },
];

/** TM serves 25 rows a page; a healthy fetch always fills it. Anything well short of
 *  that means the selectors moved or we got a rate-limit stub, not a quiet season. */
const MIN_ROWS = 20;

const yy = (year: number) => String(year % 100).padStart(2, "0");
const seasonLabel = (year: number) => `${yy(year)}/${yy(year + 1)}`;
const windowLabel = (from: number, to: number) =>
  from === to ? seasonLabel(from) : `${seasonLabel(from)} – ${seasonLabel(to)}`;

/** The season the rest of the pipeline settled on (coverage-driven, see
 *  lib/season-selection.ts). Never hardcode a season here. */
async function currentSeason(): Promise<number> {
  const raw = await readFile(join(DATA_DIR, "season.txt"), "utf-8");
  const year = Number(raw.trim());
  if (!Number.isInteger(year) || year < 2000) {
    throw new Error(`data/season.txt does not hold a season id: ${JSON.stringify(raw)}`);
  }
  return year;
}

function buildUrl(from: number, to: number, ids?: string): string {
  const params = new URLSearchParams({
    ...(ids ? { ids } : {}),
    sa: "",
    saison_id: String(from),
    saison_id_bis: String(to),
    land_id: "",
    nat: "",
    kontinent_id: "",
    pos: "",
    altersklasse: "",
    w_s: "",
    leihe: "",
    intern: "0",
    plus: "0",
  });
  return `${BASE_URL}/transfers/einnahmenausgaben/statistik/plus/0?${params}`;
}

/** "€737.10m" | "€3.20bn" | "€-1,166.91m" | "-" → millions of euros. */
function parseMoney(raw: string): number {
  const s = raw.replace(/[€\s,]/g, "");
  if (!s || s === "-") return 0;
  const n = parseFloat(s);
  if (Number.isNaN(n)) return 0;
  if (s.endsWith("bn")) return n * 1000;
  if (s.endsWith("k")) return n / 1000;
  return n;
}

function parseClubs(html: string, where: string): TransferBalanceClub[] {
  const table = html.match(/<table class="items"[\s\S]*?<\/table>/)?.[0];
  if (!table) throw new Error(`No results table on ${where} — selectors moved.`);

  const clubs = [...table.matchAll(/<tr[^>]*class="(?:odd|even)"[\s\S]*?<\/tr>/g)]
    .map((match): TransferBalanceClub | null => {
      const row = match[0];
      const link = row.match(/href="\/([^/"]+)\/transfers\/verein\/(\d+)/);
      const name = row.match(/<a title="([^"]+)"/)?.[1];
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) =>
        c[1]
          .replace(/<[^>]*>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
      );
      if (!link || !name || cells.length < 8) return null;
      const [, , , expenditure, arrivals, income, departures, balance] = cells;
      return {
        id: link[2],
        slug: link[1],
        name,
        expenditure: parseMoney(expenditure),
        arrivals: Number(arrivals) || 0,
        income: parseMoney(income),
        departures: Number(departures) || 0,
        balance: parseMoney(balance),
      };
    })
    .filter((c): c is TransferBalanceClub => c !== null);

  if (clubs.length < MIN_ROWS) {
    throw new Error(
      `Parsed only ${clubs.length} clubs from ${where} (expected >= ${MIN_ROWS}) — selectors moved or Transfermarkt is rate limiting.`,
    );
  }
  return clubs;
}

async function buildWindow(seasons: number, to: number): Promise<TransferBalanceWindow> {
  const from = to - (seasons - 1);
  const label = windowLabel(from, to);

  const tables = await Promise.all(
    SORTS.map(async ({ metric, ids }) => ({
      metric,
      clubs: parseClubs(await fetchPage(buildUrl(from, to, ids)), `${label} sorted by ${metric}`),
    })),
  );

  // Each sort returns a different top-25 slice of the same table; union them so the
  // page has every club that leads on any measure.
  const byId = new Map<string, TransferBalanceClub>();
  const leaders = {} as TransferBalanceWindow["leaders"];
  for (const { metric, clubs } of tables) {
    for (const club of clubs) byId.set(club.id, club);
    const top = clubs[0];
    leaders[metric] = {
      id: top.id,
      name: top.name,
      value:
        metric === "expenditure" ? top.expenditure : metric === "income" ? top.income : top.balance,
    };
  }

  const wins: Record<string, TransferBalanceMetric[]> = {};
  for (const metric of Object.keys(leaders) as TransferBalanceMetric[]) {
    (wins[leaders[metric].id] ??= []).push(metric);
  }
  const winners = Object.entries(wins)
    .filter(([, metrics]) => metrics.length >= 2)
    .map(([id, metrics]) => ({ id, name: byId.get(id)!.name, metrics }));

  return {
    seasons,
    from,
    to,
    label,
    leaders,
    wins,
    winners,
    clubs: [...byId.values()].sort((a, b) => b.expenditure - a.expenditure),
  };
}

async function main() {
  // 16 pages total (4 windows x 4 sorts); the statistics pages rate-limit harder
  // than player pages, so stay well under the shared default.
  setMaxConcurrent(4);

  const to = await currentSeason();
  const windows = await Promise.all(LADDER.map((seasons) => buildWindow(seasons, to)));
  const result: TransferBalanceResult = { windows };

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(join(DATA_DIR, "transfer-balance.json"), JSON.stringify(result));
  await writeFile(join(DATA_DIR, "transfer-balance-updated-at.txt"), new Date().toISOString());

  for (const w of windows) {
    const winner = w.winners[0];
    console.log(
      `[${LABEL}] ${w.label}: ${w.clubs.length} clubs — ` +
        (winner ? `${winner.name} (${winner.metrics.join(" + ")})` : "no club tops two of four"),
    );
  }
  console.log(`[${LABEL}] Done`);
}

main().catch((err) => {
  console.error(`[${LABEL}] Fatal error:`, err);
  process.exit(1);
});
