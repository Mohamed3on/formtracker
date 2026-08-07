import { describe, expect, it } from "vitest";
import { chooseSeason, seasonCoverage, type SeasonSource } from "./season-selection";
import type { CeapiGame } from "@/app/types";

function game(seasonId: number, playedMinutes: number): CeapiGame {
  return {
    gameInformation: { seasonId, competitionTypeId: 1, competitionId: "GB1" },
    statistics: {
      generalStatistics: {},
      goalStatistics: {},
      playingTimeStatistics: { playedMinutes },
    },
  };
}

/** n players; `withNew` of them have a played game in `newSeason`, everyone has last season. */
function makeCache(
  n: number,
  withNew: number,
  newSeason: number,
): { cache: Record<string, SeasonSource>; ids: string[] } {
  const cache: Record<string, SeasonSource> = {};
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const id = `p${i}`;
    ids.push(id);
    const rawGames = [game(newSeason - 1, 90)];
    if (i < withNew) rawGames.push(game(newSeason, 45));
    cache[id] = { data: { rawGames } };
  }
  return { cache, ids };
}

describe("seasonCoverage", () => {
  it("counts only players with a played/scored game in the season", () => {
    const { cache, ids } = makeCache(10, 4, 2026);
    expect(seasonCoverage(cache, ids, 2026)).toBe(0.4);
    expect(seasonCoverage(cache, ids, 2025)).toBe(1);
  });

  it("ignores benched appearances (0 minutes, no goals)", () => {
    const cache: Record<string, SeasonSource> = {
      a: { data: { rawGames: [game(2026, 0), game(2025, 90)] } },
    };
    expect(seasonCoverage(cache, ["a"], 2026)).toBe(0);
  });

  it("ignores players missing from the cache", () => {
    const { cache, ids } = makeCache(4, 4, 2026);
    expect(seasonCoverage(cache, [...ids, "ghost"], 2026)).toBe(1);
  });
});

describe("chooseSeason", () => {
  it("holds the previous season while the new one is empty (the Aug gap)", () => {
    const { cache, ids } = makeCache(100, 2, 2026);
    expect(chooseSeason(cache, ids, 2026)).toBe(2025);
  });

  it("flips once the new season crosses the coverage threshold", () => {
    const { cache, ids } = makeCache(100, 40, 2026);
    expect(chooseSeason(cache, ids, 2026)).toBe(2026);
  });

  it("stays put just under the threshold", () => {
    const { cache, ids } = makeCache(100, 34, 2026);
    expect(chooseSeason(cache, ids, 2026)).toBe(2025);
  });

  it("throws when last-season coverage collapses (broken ceapi payloads)", () => {
    const cache: Record<string, SeasonSource> = {};
    const ids: string[] = [];
    for (let i = 0; i < 100; i++) {
      ids.push(`p${i}`);
      cache[`p${i}`] = { data: { rawGames: [] } };
    }
    expect(() => chooseSeason(cache, ids, 2026)).toThrow(/last-season stats/);
  });

  it("does not fire the health guard on tiny samples", () => {
    const cache: Record<string, SeasonSource> = { a: { data: { rawGames: [] } } };
    expect(chooseSeason(cache, ["a"], 2026)).toBe(2025);
  });
});
