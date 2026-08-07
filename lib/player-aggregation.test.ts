import { describe, expect, it } from "vitest";
import {
  aggregateSeasonStats,
  reaggregatePlayerStats,
  type CeapiGame,
  type ClubTypes,
  type PlayerStatsResult,
} from "./player-aggregation";

const CLUB = "281"; // current club (senior, per clubTypes below)
const OTHER_SENIOR = "985";
const B_TEAM = "5220";
const UNKNOWN_SENIOR = "9999"; // not in clubTypes — falls back to clubId equality

const clubTypes: ClubTypes = { [CLUB]: 1, [OTHER_SENIOR]: 1, [B_TEAM]: 3 };

type GameOpts = {
  seasonId?: number;
  clubId?: string;
  compId?: string;
  compTypeId?: number;
  national?: boolean;
  minutes?: number;
  goals?: number;
  assists?: number;
  penGoals?: number;
  penMisses?: number;
  state?: string;
  posId?: number;
  date?: string;
};

function game({
  seasonId = 2025,
  clubId = CLUB,
  compId = "GB1",
  compTypeId = 1,
  national = false,
  minutes = 90,
  goals = 0,
  assists = 0,
  penGoals = 0,
  penMisses = 0,
  state = "",
  posId = 14,
  date = "2026-01-10",
}: GameOpts = {}): CeapiGame {
  return {
    gameInformation: {
      gameId: "g1",
      seasonId,
      competitionTypeId: compTypeId,
      competitionId: compId,
      isNationalGame: national,
      date: { dateTimeUTC: `${date}T15:00:00Z` },
    },
    clubsInformation: { club: { clubId }, opponent: { clubId: "418" } },
    statistics: {
      generalStatistics: { positionId: posId, participationState: state },
      goalStatistics: {
        goalsScoredTotal: goals,
        assists,
        penaltyShooterGoalsScored: penGoals,
        penaltyShooterMisses: penMisses,
      },
      playingTimeStatistics: { playedMinutes: minutes },
    },
  };
}

describe("aggregateSeasonStats", () => {
  it("only counts games from the requested season", () => {
    const s = aggregateSeasonStats(
      [game({ seasonId: 2025, goals: 2 }), game({ seasonId: 2024, goals: 5 })],
      CLUB,
      clubTypes,
      2025,
    );
    expect(s.goals).toBe(2);
    expect(s.appearances).toBe(1);
  });

  it("counts major-tournament national games as intl and recent form, never club totals", () => {
    const s = aggregateSeasonStats(
      [game({ national: true, compId: "FIWC", goals: 1, minutes: 90 })],
      CLUB,
      clubTypes,
      2025,
    );
    expect(s.intlGoals).toBe(1);
    expect(s.intlAppearances).toBe(1);
    expect(s.goals).toBe(0);
    expect(s.totalGames).toBe(0);
    expect(s.recentForm).toHaveLength(1);
    expect(s.recentForm[0].competitionName).toBe("World Cup");
  });

  it("ignores national friendlies and qualifiers entirely", () => {
    const s = aggregateSeasonStats(
      [
        game({ national: true, compId: "FS", goals: 2 }),
        game({ national: true, compId: "WMQ4", goals: 1 }),
      ],
      CLUB,
      clubTypes,
      2025,
    );
    expect(s.intlGoals).toBe(0);
    expect(s.recentForm).toHaveLength(0);
  });

  it("keeps previous-club senior games but drops B-team games", () => {
    const s = aggregateSeasonStats(
      [
        game({ clubId: OTHER_SENIOR, minutes: 45 }),
        game({ clubId: B_TEAM, minutes: 90, goals: 3 }),
      ],
      CLUB,
      clubTypes,
      2025,
    );
    expect(s.minutes).toBe(45);
    expect(s.goals).toBe(0);
  });

  it("falls back to clubId equality when the clubType is unresolved", () => {
    const s = aggregateSeasonStats(
      [game({ clubId: UNKNOWN_SENIOR, minutes: 60 })],
      UNKNOWN_SENIOR,
      clubTypes,
      2025,
    );
    expect(s.minutes).toBe(60);
    const dropped = aggregateSeasonStats(
      [game({ clubId: UNKNOWN_SENIOR, minutes: 60 })],
      CLUB,
      clubTypes,
      2025,
    );
    expect(dropped.minutes).toBe(0);
  });

  it("gates topFlightGoals on the competition-type whitelist", () => {
    const s = aggregateSeasonStats(
      [
        game({ compTypeId: 1, goals: 1 }), // first tier
        game({ compTypeId: 8, goals: 1 }), // domestic cup
        game({ compTypeId: 2, goals: 1, compId: "GB2" }), // 2nd tier — goal counts, gate doesn't
      ],
      CLUB,
      clubTypes,
      2025,
    );
    expect(s.goals).toBe(3);
    expect(s.topFlightGoals).toBe(2);
  });

  it("tracks availability: missed states and benched games", () => {
    const s = aggregateSeasonStats(
      [
        game({ minutes: 90 }),
        game({ minutes: 0, state: "injured" }),
        game({ minutes: 0, state: "on_the_bench" }),
      ],
      CLUB,
      clubTypes,
      2025,
    );
    expect(s.totalGames).toBe(3);
    expect(s.gamesMissed).toBe(1);
    expect(s.appearances).toBe(1);
  });

  it("sorts recent form newest-first and keeps 10", () => {
    const games = Array.from({ length: 12 }, (_, i) =>
      game({ date: `2026-01-${String(i + 1).padStart(2, "0")}` }),
    );
    const s = aggregateSeasonStats(games, CLUB, clubTypes, 2025);
    expect(s.recentForm).toHaveLength(10);
    expect(s.recentForm[0].date).toBe("2026-01-12");
    expect(s.recentForm[9].date).toBe("2026-01-03");
  });

  it("derives playedPosition from the position with most minutes", () => {
    const s = aggregateSeasonStats(
      [game({ posId: 14, minutes: 90 }), game({ posId: 11, minutes: 30 })],
      CLUB,
      clubTypes,
      2025,
    );
    expect(s.playedPosition).toBe("Centre-Forward");
    expect(s.positionStats?.[0].position).toBe("Centre-Forward");
    expect(s.positionStats?.[1].position).toBe("Left Winger");
  });
});

describe("reaggregatePlayerStats", () => {
  const base: PlayerStatsResult = {
    minutes: 0,
    appearances: 0,
    goals: 0,
    topFlightGoals: 0,
    assists: 0,
    penaltyGoals: 0,
    penaltyMisses: 0,
    intlGoals: 0,
    intlAssists: 0,
    intlMinutes: 0,
    intlAppearances: 0,
    intlPenaltyGoals: 0,
    intlCareerCaps: 57,
    isCurrentIntl: true,
    club: "Test FC",
    clubLogoUrl: `https://tmssl.akamaized.net/images/wappen/head/${CLUB}.png`,
    league: "",
    isNewSigning: false,
    isOnLoan: false,
    playedPosition: "",
    gamesMissed: 0,
    totalGames: 0,
    positionStats: [],
    marketValue: 50_000_000,
    marketValueDisplay: "€50.00m",
    age: 25,
  };

  it("rebuilds stats for the requested season from rawGames", () => {
    const prev = {
      ...base,
      rawGames: [game({ seasonId: 2025, goals: 2 }), game({ seasonId: 2026, goals: 1 })],
    };
    expect(reaggregatePlayerStats(prev, clubTypes, 2025).goals).toBe(2);
    expect(reaggregatePlayerStats(prev, clubTypes, 2026).goals).toBe(1);
  });

  it("preserves non-stat fields and returns prev untouched without rawGames", () => {
    const re = reaggregatePlayerStats({ ...base, rawGames: [game({ goals: 1 })] }, clubTypes, 2025);
    expect(re.intlCareerCaps).toBe(57);
    expect(re.marketValue).toBe(50_000_000);
    expect(reaggregatePlayerStats(base, clubTypes, 2025)).toBe(base);
  });
});
