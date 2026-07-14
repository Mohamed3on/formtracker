import * as cheerio from "cheerio";
import { tmFetch } from "@/lib/proxy";

/**
 * Checks if Transfermarkt has published market value updates within the last ~36 hours.
 * Exits 0 if recent updates found (should trigger refresh), 1 if not.
 */

const URL =
  "https://www.transfermarkt.com/spieler-statistik/marktwertaenderungen/marktwertetop?ajax=yw1&alter=16+-+45&filtern_nach_alter=16%3B45&galerie=0&maxAlter=45&maxMarktwert=200.000.000&minAlter=16&minMarktwert=5.000.000&plus=0&position=alle&spieler_land_id=0&spielerposition_id=0&verein_land_id=&wettbewerb_id=alle&yt0=Show";

const REFERER =
  "https://www.transfermarkt.com/spieler-statistik/marktwertaenderungen/marktwertetop/?plus=0&galerie=0&position=alle&spielerposition_id=0&spieler_land_id=0&verein_land_id=&wettbewerb_id=alle&alter=16+-+45&filtern_nach_alter=16%3B45&minAlter=16&maxAlter=45&minMarktwert=5.000.000&maxMarktwert=200.000.000&yt0=Show";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
  Accept: "*/*",
  "X-Requested-With": "XMLHttpRequest",
  Referer: REFERER,
  "sec-ch-ua-platform": '"macOS"',
  "sec-ch-ua": '"Chromium";v="145", "Not:A-Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
};

async function main() {
  const res = await tmFetch(URL, {
    headers: { ...HEADERS, ...(process.env.TM_COOKIE ? { Cookie: process.env.TM_COOKIE } : {}) },
  });
  const html = await res.text();

  if (html.length < 500) {
    console.log("Rate limited or empty response, skipping.");
    process.exit(1);
  }

  const $ = cheerio.load(html);

  // Parse DD.MM.YYYY dates from the last cell of each row
  const datePattern = /^(\d{2})\.(\d{2})\.(\d{4})$/;
  const dates = new Set<string>();
  $("table.items > tbody > tr").each((_, row) => {
    const lastTd = $(row).children("td").last().text().trim();
    if (datePattern.test(lastTd)) dates.add(lastTd);
  });

  // Check if any date is within the last ~36 hours
  const now = Date.now();
  const THRESHOLD_MS = 36 * 60 * 60 * 1000;
  let hasRecent = false;

  console.log(`Now (UTC): ${new Date(now).toISOString()}`);
  console.log(`Dates on page: ${[...dates].join(", ")}`);

  for (const d of dates) {
    const [, dd, mm, yyyy] = d.match(datePattern)!;
    const dateMs = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`).getTime();
    if (now - dateMs < THRESHOLD_MS) {
      hasRecent = true;
      break;
    }
  }

  if (hasRecent) {
    console.log("Recent market value updates found!");
    process.exit(0);
  }

  console.log("No recent updates.");
  process.exit(1);
}

main().catch((err) => {
  console.error("Check failed:", err);
  process.exit(1);
});
