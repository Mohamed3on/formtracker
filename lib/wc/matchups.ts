import { shortName, type Round, type Team } from "./model";
import type { GroupFixture, Kick } from "./fixtures";
import type { LiveModel } from "./live";

export type MatchupTeam = { name: string; short: string; flag: string; mv: number };
export type Stage = "group" | Round | "3RD";
export type MatchupRow = {
  id: string;
  stage: Stage;
  group: string | null; // group letter (group games only)
  matchday: number | null; // 1-3 (group games only)
  home: MatchupTeam;
  away: MatchupTeam;
  sum: number; // combined squad market value (millions)
  vrank: number; // 1 = most valuable across the whole schedule
  hs: number | null;
  as: number | null;
  played: boolean;
  projected: boolean; // teams are a value projection, not yet a confirmed matchup
  kickoff: number;
  dow: string;
  dayLabel: string;
  timeLabel: string;
};

// Every World Cup match — real group fixtures plus knockout games (projected by value,
// with real teams/scores swapped in as the live model resolves them) — ranked by
// combined squad market value (1 = most valuable across the whole schedule).
export function buildMatchups(
  teams: Team[],
  fixtures: GroupFixture[],
  live: LiveModel,
  koDates: Record<string, Kick>,
): MatchupRow[] {
  const byName = Object.fromEntries(teams.map((t) => [t.name, t])) as Record<string, Team>;
  const lite = (n: string): MatchupTeam => {
    const t = byName[n];
    return { name: n, short: shortName(n), flag: t?.flag ?? "🏳️", mv: t?.mv ?? 0 };
  };

  const groupRows: MatchupRow[] = fixtures
    .filter((f) => byName[f.home] && byName[f.away])
    .map((f) => {
      const home = lite(f.home);
      const away = lite(f.away);
      return {
        id: `${f.home}__${f.away}`,
        stage: "group",
        group: f.group,
        matchday: f.matchday,
        home,
        away,
        sum: home.mv + away.mv,
        vrank: 0,
        hs: f.hs,
        as: f.as,
        played: f.played,
        projected: false,
        kickoff: f.kickoff,
        dow: f.dow,
        dayLabel: f.dayLabel,
        timeLabel: f.timeLabel,
      };
    });

  // Knockout: each bracket card carries the live model's slot (real teams/scores where
  // known, the value projection otherwise) dropped onto its official kickoff date.
  const { bracket } = live.model;
  const koRows: MatchupRow[] = [];
  for (const c of bracket.cards) {
    const key = `${c.round}-${c.num}`;
    const date = koDates[key];
    if (!date) continue; // no scraped date → skip rather than mis-sort by 0
    const lc = live.cardByKey[key];
    const home = lc?.home ?? c.home;
    const away = lc?.away ?? c.away;
    koRows.push({
      id: key,
      stage: c.round,
      group: null,
      matchday: null,
      home,
      away,
      sum: home.mv + away.mv,
      vrank: 0,
      hs: lc?.hs ?? null,
      as: lc?.as ?? null,
      played: !!lc?.played,
      projected: !lc?.real,
      ...date,
    });
  }
  // Third-place play-off — always a value projection (not tracked by the live overlay).
  const { third } = bracket;
  const thirdDate = koDates["3RD"];
  if (thirdDate)
    koRows.push({
      id: "3RD",
      stage: "3RD",
      group: null,
      matchday: null,
      home: third.home,
      away: third.away,
      sum: third.home.mv + third.away.mv,
      vrank: 0,
      hs: null,
      as: null,
      played: false,
      projected: true,
      ...thirdDate,
    });

  return [...groupRows, ...koRows]
    .sort((a, b) => b.sum - a.sum)
    .map((r, i) => ({ ...r, vrank: i + 1 }));
}
