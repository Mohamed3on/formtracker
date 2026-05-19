import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { analyzeMinutesRegressions } from "./minutes-regression";
import type { MinutesValuePlayer } from "@/app/types";

const makePlayer = (
  playerId: string,
  name: string,
  club: string,
  minutes: number,
): MinutesValuePlayer =>
  ({
    playerId,
    name,
    club,
    minutes,
    marketValue: 1_000_000,
  }) as MinutesValuePlayer;

describe("analyzeMinutesRegressions", () => {
  it("returns no failures when nothing regressed", () => {
    const old = [makePlayer("1", "A", "X", 100)];
    const fresh = [makePlayer("1", "A", "X", 105)];
    const r = analyzeMinutesRegressions(old, fresh);
    expect(r.scattered).toHaveLength(0);
    expect(r.ignoredClubs).toHaveLength(0);
    expect(r.fail).toBe(false);
  });

  it("treats ≤5' drops as noise (within MINUTES_DROP_TOLERANCE)", () => {
    const old = [makePlayer("1", "A", "X", 100)];
    const fresh = [makePlayer("1", "A", "X", 96)];
    expect(analyzeMinutesRegressions(old, fresh).scattered).toHaveLength(0);
  });

  it("ignores whole-club corrections (≥3 players and ≥50% of club regressed)", () => {
    const old = [
      makePlayer("1", "A", "Hilal", 1000),
      makePlayer("2", "B", "Hilal", 1000),
      makePlayer("3", "C", "Hilal", 1000),
      makePlayer("4", "D", "Hilal", 1000),
      makePlayer("5", "E", "Other", 1000),
    ];
    const fresh = [
      makePlayer("1", "A", "Hilal", 910),
      makePlayer("2", "B", "Hilal", 910),
      makePlayer("3", "C", "Hilal", 910),
      makePlayer("4", "D", "Hilal", 1000),
      makePlayer("5", "E", "Other", 1000),
    ];
    const r = analyzeMinutesRegressions(old, fresh);
    expect(r.ignoredClubs).toEqual(["Hilal"]);
    expect(r.ignoredCount).toBe(3);
    expect(r.scattered).toHaveLength(0);
    expect(r.fail).toBe(false);
  });

  it("does NOT flag whole-club when only 2 of a large club regressed", () => {
    const all = Array.from({ length: 20 }, (_, i) =>
      makePlayer(String(i), `P${i}`, "BigClub", 1000),
    );
    const fresh = all.map((p, i) => (i < 2 ? { ...p, minutes: 910 } : p));
    const r = analyzeMinutesRegressions(all, fresh);
    expect(r.ignoredClubs).toHaveLength(0);
    expect(r.scattered).toHaveLength(2);
  });

  it("tolerates scattered drops up to max(10, 2% of dataset)", () => {
    const old = Array.from({ length: 500 }, (_, i) =>
      makePlayer(String(i), `P${i}`, `Club${i % 50}`, 1000),
    );
    const fresh = old.map((p, i) => (i < 10 ? { ...p, minutes: 910 } : p));
    const r = analyzeMinutesRegressions(old, fresh);
    expect(r.maxScattered).toBe(10);
    expect(r.scattered).toHaveLength(10);
    expect(r.fail).toBe(false);
  });

  it("fails when scattered drops exceed tolerance", () => {
    const old = Array.from({ length: 500 }, (_, i) =>
      makePlayer(String(i), `P${i}`, `Club${i % 50}`, 1000),
    );
    const fresh = old.map((p, i) => (i < 50 ? { ...p, minutes: 910 } : p));
    const r = analyzeMinutesRegressions(old, fresh);
    expect(r.fail).toBe(true);
    expect(r.scattered.length).toBeGreaterThan(r.maxScattered);
  });

  it("handles empty club strings gracefully", () => {
    const old = [makePlayer("1", "A", "", 1000), makePlayer("2", "B", "", 1000)];
    const fresh = [makePlayer("1", "A", "", 910), makePlayer("2", "B", "Other", 1000)];
    const r = analyzeMinutesRegressions(old, fresh);
    expect(r.fail).toBe(false);
    expect(r.scattered).toHaveLength(1);
  });

  it("ignores Al-Hilal whole-club regression from the real failed CI run", () => {
    const old = JSON.parse(
      readFileSync(join(process.cwd(), "data/minutes-value.json"), "utf-8"),
    ) as MinutesValuePlayer[];
    // Simulate the actual TM correction: 5 Al-Hilal players lose ~90'
    const dropped: Record<string, number> = {
      "339808": 90, // Theo Hernández
      "225161": 90, // Rúben Neves
      "266302": 90, // Sergej Milinković-Savić
      "668267": 79, // Marcos Leonardo
      "323704": 89, // Malcom
    };
    const fresh = old.map((p) => {
      const drop = dropped[p.playerId];
      return drop ? { ...p, minutes: p.minutes - drop } : p;
    });
    const droppedNames = Object.keys(dropped);
    expect(droppedNames.every((id) => old.some((p) => p.playerId === id))).toBe(true);

    const r = analyzeMinutesRegressions(old, fresh);
    expect(r.ignoredClubs).toContain("Al-Hilal");
    expect(r.fail).toBe(false);
  });
});
