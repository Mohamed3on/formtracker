/**
 * Fetches one www.transfermarkt.com URL and writes the raw HTML to disk.
 *
 * Development escape hatch, not part of any data flow: Transfermarkt's WAF blocks
 * most datacenter and some residential ranges with an empty 202, so a dev machine
 * often can't see a page it needs to write a parser against. This runs on a CI
 * runner instead, where TM_RELAY_URL points at workers/tm-relay, and uploads the
 * HTML as an artifact (.github/workflows/dump-tm-page.yml). Fetch it, write the
 * parser locally against the fixture, then wire the real scraper to fetchPage.
 *
 *   TM_DUMP_URL="https://www.transfermarkt.com/..." bun run scripts/dump-tm-page.ts
 *   bun run scripts/dump-tm-page.ts "https://www.transfermarkt.com/..." out.html
 */
import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fetchPage } from "@/lib/fetch";

const ALLOWED_HOST = "www.transfermarkt.com";

async function main() {
  const url = process.argv[2] ?? process.env.TM_DUMP_URL;
  if (!url) throw new Error("No URL given (argv[2] or TM_DUMP_URL)");

  // The relay enforces this too, but failing here costs one bad argument instead
  // of a round-trip that comes back as an opaque 403.
  const host = new URL(url).hostname;
  if (host !== ALLOWED_HOST) throw new Error(`Host not allowed: ${host}`);

  const out = join(process.cwd(), process.argv[3] ?? process.env.TM_DUMP_OUT ?? "tmp/tm-dump.html");
  const html = await fetchPage(url);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, html);
  console.log(`Wrote ${html.length} bytes to ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
