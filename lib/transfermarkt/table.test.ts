import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { parsePlayerTable } from "./table";

// A real Premier League injured page, captured 2026-07. Refresh the fixture when
// Transfermarkt changes its markup; the assertions below survive a refresh.
const html = readFileSync(
  fileURLToPath(new URL("./__fixtures__/injured-premier-league.html", import.meta.url)),
  "utf8",
);

// Mirror the injured page's column layout so the fixture exercises the real
// player-listing shape end-to-end (identity + page-specific columns).
const rows = parsePlayerTable(html, (player, row) => ({
  name: player.name,
  playerId: player.playerId,
  profileUrl: player.profileUrl,
  imageUrl: player.imageUrl,
  position: player.position,
  club: row.link(1).title,
  clubLogo: row.image(1),
  marketValue: row.text(7),
}));

describe("parsePlayerTable — real injured (Premier League) fixture", () => {
  it("parses every player row, skipping headers/spacers", () => {
    expect(rows).toHaveLength(32);
  });

  it("parses identity + page-specific columns for a known player", () => {
    const timber = rows.find((r) => r.playerId === "420243");
    expect(timber).toMatchObject({
      name: "Jurriën Timber",
      position: "Right-Back",
      club: "Arsenal FC",
      marketValue: "€70.00m",
      profileUrl: "/jurrien-timber/profil/spieler/420243", // module returns the raw TM href
    });
  });

  it("upgrades images to the largest size (tmImage), not the scraped size", () => {
    const timber = rows.find((r) => r.playerId === "420243")!;
    expect(timber.imageUrl).toContain("/portrait/header/"); // scraped as /portrait/medium/
    expect(timber.clubLogo).toContain("/wappen/head/"); // scraped as /wappen/tiny/
  });

  it("matches the parsed snapshot", () => {
    expect(rows).toMatchSnapshot();
  });
});

// The market-value page puts the player cell in column 1 (column 0 is the rank) and
// carries nationality as an image title — exercises playerColumn + imageTitle.
const mvHtml = readFileSync(
  fileURLToPath(new URL("./__fixtures__/market-value-top.html", import.meta.url)),
  "utf8",
);

const mvRows = parsePlayerTable(
  mvHtml,
  (player, row) => {
    if (!player.name || !player.playerId) return null;
    return {
      name: player.name,
      playerId: player.playerId,
      position: player.position,
      imageUrl: player.imageUrl,
      age: parseInt(row.text(2)) || 0,
      nationality: row.imageTitle(3),
      flag: row.image(3),
      club: row.link(4).title || row.imageTitle(4),
      marketValue: row.text(5),
    };
  },
  { playerColumn: 1 },
);

describe("parsePlayerTable — real market-value page (player cell in column 1)", () => {
  it("parses every row from the rank-prefixed table", () => {
    expect(mvRows).toHaveLength(25);
  });

  it("reads nationality / club / value / age for the top-valued player", () => {
    const top = mvRows[0];
    expect(top.nationality).not.toBe("");
    expect(top.club).not.toBe("");
    expect(top.marketValue).toMatch(/€\d/);
    expect(top.age).toBeGreaterThan(0);
  });

  it("upgrades headshots and flags to the largest size via tmImage", () => {
    expect(mvRows[0].imageUrl).toContain("/portrait/header/");
    expect(mvRows[0].flag).toContain("/flagge/head/");
  });

  it("matches the parsed snapshot", () => {
    expect(mvRows).toMatchSnapshot();
  });
});

// The market-value movers (changes) page carries the previous value in a <span
// title="…"> inside the value cell — exercises the attr() escape hatch.
const moversHtml = readFileSync(
  fileURLToPath(new URL("./__fixtures__/market-value-movers.html", import.meta.url)),
  "utf8",
);

const moverRows = parsePlayerTable(
  moversHtml,
  (player, row) => {
    const prevTitle = row.attr(5, "span", "title");
    if (!player.name || !player.playerId || !prevTitle) return null;
    return {
      name: player.name,
      playerId: player.playerId,
      club: row.link(2).title,
      nationality: row.imageTitle(3),
      currentValue: row.text(5).replace(/ /g, "").trim(),
      previousTitle: prevTitle,
      clubLogo: row.image(2),
    };
  },
  { playerColumn: 1 },
);

describe("parsePlayerTable — real market-value movers page (attr escape hatch)", () => {
  it("parses the changes table", () => {
    expect(moverRows.length).toBeGreaterThan(10);
  });

  it("reads the previous value from the span title via attr()", () => {
    expect(moverRows[0].previousTitle).toMatch(/€/);
  });

  it("upgrades club crests to the largest size via tmImage", () => {
    expect(moverRows[0].clubLogo).toContain("/wappen/head/");
  });

  it("matches the parsed snapshot", () => {
    expect(moverRows).toMatchSnapshot();
  });
});
