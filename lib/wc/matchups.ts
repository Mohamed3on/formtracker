import { shortName, type Team } from "./model";
import type { GroupFixture } from "./fixtures";

export type MatchupTeam = { name: string; short: string; flag: string; mv: number };
export type MatchupRow = {
  id: string;
  group: string;
  matchday: number;
  home: MatchupTeam;
  away: MatchupTeam;
  sum: number; // combined squad market value (millions)
  vrank: number; // 1 = most/least valuable within its list
  hs: number | null;
  as: number | null;
  played: boolean;
  kickoff: number;
  dow: string;
  dayLabel: string;
  timeLabel: string;
};
export type MatchupExtremes = { most: MatchupRow[]; least: MatchupRow[] };

// Top 10 and bottom 10 group-stage matchups by combined squad market value.
export function buildMatchupExtremes(teams: Team[], fixtures: GroupFixture[]): MatchupExtremes {
  const byName = Object.fromEntries(teams.map((t) => [t.name, t])) as Record<string, Team>;
  const lite = (n: string): MatchupTeam => {
    const t = byName[n];
    return { name: n, short: shortName(n), flag: t?.flag ?? "🏳️", mv: t?.mv ?? 0 };
  };

  const rows: MatchupRow[] = fixtures
    .filter((f) => byName[f.home] && byName[f.away])
    .map((f) => {
      const home = lite(f.home);
      const away = lite(f.away);
      return {
        id: `${f.home}__${f.away}`,
        group: f.group,
        matchday: f.matchday,
        home,
        away,
        sum: home.mv + away.mv,
        vrank: 0,
        hs: f.hs,
        as: f.as,
        played: f.played,
        kickoff: f.kickoff,
        dow: f.dow,
        dayLabel: f.dayLabel,
        timeLabel: f.timeLabel,
      };
    })
    .sort((a, b) => b.sum - a.sum);

  return {
    most: rows.slice(0, 10).map((r, i) => ({ ...r, vrank: i + 1 })),
    least: rows
      .slice(-10)
      .reverse()
      .map((r, i) => ({ ...r, vrank: i + 1 })),
  };
}
