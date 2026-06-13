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
  // MD3 only: true = both teams already secured top-2 (qualification can't change),
  // false = stakes remain, null = not yet decidable (matchday 1-2 still pending).
  deadRubber: boolean | null;
};
export type MatchupExtremes = { most: MatchupRow[]; least: MatchupRow[] };

// Top 10 and bottom 10 group-stage matchups by combined squad market value.
export function buildMatchupExtremes(teams: Team[], fixtures: GroupFixture[]): MatchupExtremes {
  const byName = Object.fromEntries(teams.map((t) => [t.name, t])) as Record<string, Team>;
  const lite = (n: string): MatchupTeam => {
    const t = byName[n];
    return { name: n, short: shortName(n), flag: t?.flag ?? "🏳️", mv: t?.mv ?? 0 };
  };

  // Per group: has a team clinched a top-2 spot going into matchday 3? Only decidable
  // once all four matchday 1-2 games are played (one game left, max +3 for everyone).
  // Sound (no false positives): X is safe if ≥2 rivals can't even reach X's current
  // points (pts+3 < X). Ignores goal difference, so it under-claims rather than over.
  const clinchedTop2: Record<string, (team: string) => boolean | null> = {};
  for (const g of [...new Set(fixtures.map((f) => f.group))]) {
    const early = fixtures.filter((f) => f.group === g && f.matchday <= 2);
    if (early.length !== 4 || !early.every((f) => f.played)) {
      clinchedTop2[g] = () => null;
      continue;
    }
    const pts: Record<string, number> = {};
    const bump = (t: string, p: number) => (pts[t] = (pts[t] ?? 0) + p);
    for (const f of early) {
      const h = f.hs as number;
      const a = f.as as number;
      bump(f.home, h > a ? 3 : h === a ? 1 : 0);
      bump(f.away, a > h ? 3 : h === a ? 1 : 0);
    }
    clinchedTop2[g] = (team) => {
      const px = pts[team] ?? 0;
      const blocked = Object.keys(pts).filter((o) => o !== team && (pts[o] ?? 0) + 3 < px).length;
      return blocked >= 2;
    };
  }
  const deadRubber = (f: GroupFixture): boolean | null => {
    if (f.matchday !== 3) return null;
    const h = clinchedTop2[f.group](f.home);
    const a = clinchedTop2[f.group](f.away);
    return h === null || a === null ? null : h && a;
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
        deadRubber: deadRubber(f),
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
