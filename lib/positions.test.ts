import { describe, expect, it } from "vitest";
import {
  getBroadPositionFilter,
  matchesPositionFilter,
  positionFilterCategory,
  positionsInFilterCategory,
} from "./positions";

const KNOWN_POSITIONS = [
  "Centre-Forward",
  "Left Winger",
  "Right Winger",
  "Second Striker",
  "Attacking Midfield",
  "Central Midfield",
  "Left Midfield",
  "Right Midfield",
  "Defensive Midfield",
  "Left Wing-Back",
  "Right Wing-Back",
  "Left-Back",
  "Right-Back",
  "Centre-Back",
  "Goalkeeper",
];

describe("position filter taxonomy", () => {
  it("profile links and list filtering agree for every position", () => {
    // The bug this locks out: a player's profile linked to ?pos=<filter> built
    // from getBroadPositionFilter while the list filtered them out (wing-backs).
    for (const position of KNOWN_POSITIONS) {
      const filter = getBroadPositionFilter(position);
      expect(matchesPositionFilter({ position }, filter)).toBe(true);
    }
  });

  it("wing-backs count as defenders", () => {
    expect(getBroadPositionFilter("Left Wing-Back")).toBe("def");
    expect(matchesPositionFilter({ position: "Right Wing-Back" }, "def")).toBe(true);
    expect(positionsInFilterCategory("def")).toContain("Left Wing-Back");
  });

  it("prefers the played position over the registered one", () => {
    const winger = { position: "Centre-Back", playedPosition: "Left Winger" };
    expect(matchesPositionFilter(winger, "att")).toBe(true);
    expect(matchesPositionFilter(winger, "def")).toBe(false);
  });

  it("supports exact-position filters and empty filter", () => {
    expect(matchesPositionFilter({ position: "Centre-Forward" }, "Centre-Forward")).toBe(true);
    expect(matchesPositionFilter({ position: "Centre-Forward" }, "Left Winger")).toBe(false);
    expect(matchesPositionFilter({ position: "Centre-Forward" }, "")).toBe(true);
  });

  it("resolves filter values to category keys", () => {
    expect(positionFilterCategory("def")).toBe("def");
    expect(positionFilterCategory("Left Wing-Back")).toBe("def");
    expect(positionFilterCategory("Left Midfield")).toBe("mid");
    expect(positionFilterCategory("garbage")).toBe(null);
  });
});
