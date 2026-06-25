// Merge the market-value prediction with real Transfermarkt results.
// Pre-tournament (no results) → pure prediction + "not started" tracker.
// As matches are played, cards/groups/tracker swap to reality.

import {
  buildModel,
  STAGE_LABEL,
  type Round,
  type Team,
  type TeamLite,
  type WcModel,
} from "./model";
import type { GroupStanding, WcResults } from "./results";

const ORD: Record<Round, number> = { R32: 1, R16: 2, QF: 3, SF: 4, F: 5 };

export type TrackerStatus = "champion" | "over" | "met" | "under" | "alive" | "pending";
export type TrackerRow = {
  team: TeamLite;
  rank: number;
  expStage: number;
  expLabel: string;
  actualStage: number | null;
  actualLabel: string;
  status: TrackerStatus;
  delta: number | null; // stage rounds vs expected, once decided
  alive: boolean;
  projStage: number; // deepest round projected: real results first, then value
  projLabel: string;
  projState: "out" | "proj" | "done"; // out: projected out in groups; proj: not yet reached; done: achieved
};
export type LiveCard = {
  home: TeamLite;
  away: TeamLite;
  winner: string | null;
  hs: number | null;
  as: number | null;
  real: boolean; // both teams confirmed (vs a value projection)
  homeReal: boolean; // this side locked to its real qualified team
  awayReal: boolean;
  played: boolean;
};
export type ThirdPlaceRow = {
  team: TeamLite;
  group: string;
  pos: number; // 1-12 in the third-placed ranking
  pl: number; // matches played
  gd: number;
  gf: number;
  pts: number;
  qualified: boolean; // among the best eight that advance to the Round of 32
  predicted: boolean; // group yet to kick off → market-value seeded
};
export type LiveGroupRow = {
  team: TeamLite;
  pos: number;
  pl: number;
  gd: number | string;
  pts: number;
  cls: string;
  predicted: boolean;
  expPos: number; // value-rank position within the group
  delta: number | null; // expPos - actualPos (>0 = above its expected slot); null until played
};
export type LiveModel = {
  model: WcModel;
  started: boolean;
  fetchedAt: number;
  tracker: TrackerRow[];
  cardByKey: Record<string, LiveCard>;
  liveGroups: Record<string, { live: boolean; rows: LiveGroupRow[] }>;
  thirdPlace: ThirdPlaceRow[]; // all 12 third-placed teams, ranked; top 8 advance
};

const GROUPS = "ABCDEFGHIJKL".split("");

export function buildLiveModel(teams: Team[], results: WcResults): LiveModel {
  // Re-seed the bracket from live group standings where a group has kicked off;
  // groups/teams that haven't played yet keep their market-value order.
  const teamsByName = Object.fromEntries(teams.map((t) => [t.name, t])) as Record<string, Team>;
  const mvGroups: Record<string, Team[]> = {};
  for (const g of GROUPS)
    mvGroups[g] = teams.filter((t) => t.group === g).sort((a, b) => b.mv - a.mv);

  const mvOf = (name: string) => teamsByName[name]?.mv ?? 0;
  const gf = (r: GroupStanding) => parseInt(r.goals) || 0;
  // Official FIFA tie-break, sourced from TM: once a team has kicked off, real
  // results decide (pts → GD → GF, then TM's published rank — which already encodes
  // head-to-head → fair play → drawing of lots). A played team can't tie an unplayed
  // one on pts/GD/GF, so the value fallback only ever orders teams yet to play at
  // all (our market-value seeding); it never overrides a real result.
  const byStanding = (a: GroupStanding, b: GroupStanding) =>
    b.pts - a.pts ||
    b.gd - a.gd ||
    gf(b) - gf(a) ||
    (a.played === 0 && b.played === 0 ? mvOf(b.name) - mvOf(a.name) : a.rank - b.rank);

  const liveOrder: Record<string, string[]> = {};
  for (const g of GROUPS) {
    const rd = results.groups[g];
    if (!rd?.anyPlayed || rd.rows.length !== 4) continue;
    const names = [...rd.rows].sort(byStanding).map((r) => r.name);
    if (names.every((n) => teamsByName[n])) liveOrder[g] = names;
  }

  // Once every group is complete and the real knockout draw is published, which
  // third-placed teams advanced is a matter of record — take the qualified groups
  // straight from the bracket (official FIFA ranking, incl. fair-play/lots) rather
  // than breaking ties by market value. Until then, value is the last-resort seed.
  const allComplete = GROUPS.every((g) => results.groups[g]?.complete);
  const realKoTeams = new Set(
    results.ko.flatMap((m) => [m.home, m.away]).filter((n): n is string => !!n),
  );
  const realThirdGroups = GROUPS.filter((g) => liveOrder[g] && realKoTeams.has(liveOrder[g][2]));
  const officialThirds =
    allComplete && realThirdGroups.length === 8 ? new Set(realThirdGroups) : null;

  // Third-placed race: rank all twelve groups' third-placed teams — real pts/GD/GF
  // where played, market value for those yet to kick off (so it stays MV pre-tournament).
  // The best eight advance to the Round of 32.
  const thirdEntries = GROUPS.map((g) => {
    const o = liveOrder[g];
    if (o) {
      const r = results.groups[g].rows.find((x) => x.name === o[2])!;
      return { g, name: o[2], pts: r.pts, gd: r.gd, gf: gf(r), pl: r.played, predicted: false };
    }
    const t = mvGroups[g][2];
    return { g, name: t.name, pts: 0, gd: 0, gf: 0, pl: 0, predicted: true };
  });
  const thirdRanked = [...thirdEntries].sort(
    (a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || mvOf(b.name) - mvOf(a.name),
  );
  const qualGroups = officialThirds ?? new Set(thirdRanked.slice(0, 8).map((t) => t.g));

  const model = buildModel(teams, { order: liveOrder, qualGroups });
  const lite = (name: string): TeamLite =>
    model.byName[name] ?? { name, short: name, flag: "🏳️", mv: 0 };
  const predGroups = new Map(model.groups.map((x) => [x.g, x.rows]));

  // Teams appearing in real KO matches at each round depth — used to infer who advanced.
  const realAtRound: Record<number, Set<string>> = {};
  for (const m of results.ko) {
    const r = ORD[m.round];
    realAtRound[r] ??= new Set();
    if (m.home) realAtRound[r].add(m.home);
    if (m.away) realAtRound[r].add(m.away);
  }
  const appearsDeeperThan = (name: string, r: number) => {
    for (let d = r + 1; d <= 5; d++) if (realAtRound[d]?.has(name)) return true;
    return false;
  };

  // ---- Overlay knockout cards ----
  const koByKey = new Map(results.ko.map((m) => [`${m.round}-${m.num}`, m]));
  const cardByKey: Record<string, LiveCard> = {};
  for (const c of model.bracket.cards) {
    const key = `${c.round}-${c.num}`;
    const m = koByKey.get(key);
    // Use whichever side TM has already locked in (e.g. Germany once it tops its
    // group); the other side stays the value projection until it's decided too.
    const home = m?.home ? lite(m.home) : c.home;
    const away = m?.away ? lite(m.away) : c.away;
    const real = !!(m && m.home && m.away); // both sides confirmed → a real matchup
    const played = !!(m && m.hs !== null && m.as !== null);
    let winner: string | null;
    if (real && m) {
      const r = ORD[c.round];
      if (m.home && appearsDeeperThan(m.home, r)) winner = m.home;
      else if (m.away && appearsDeeperThan(m.away, r)) winner = m.away;
      else if (played && m.hs !== m.as)
        winner = (m.hs as number) > (m.as as number) ? m.home : m.away;
      else winner = null; // real teams set, outcome not yet decided
    } else {
      // Project the winner by value off whatever teams we have (real or predicted).
      winner = home.mv >= away.mv ? home.name : away.name;
    }
    cardByKey[key] = {
      home,
      away,
      winner,
      hs: m?.hs ?? null,
      as: m?.as ?? null,
      real,
      homeReal: !!m?.home,
      awayReal: !!m?.away,
      played,
    };
  }

  // ---- Projected deepest stage: real results first, then higher value wins ----
  const childrenOf = model.bracket.childrenOf;
  const partsMemo: Record<string, [string, string]> = {};
  const winMemo: Record<string, string> = {};
  function parts(key: string): [string, string] {
    if (partsMemo[key]) return partsMemo[key];
    const lc = cardByKey[key];
    let pair: [string, string];
    if (lc.real) pair = [lc.home.name, lc.away.name];
    else {
      const ch = childrenOf[key];
      pair = ch ? [win(ch[0]), win(ch[1])] : [lc.home.name, lc.away.name];
    }
    return (partsMemo[key] = pair);
  }
  function win(key: string): string {
    if (winMemo[key]) return winMemo[key];
    const lc = cardByKey[key];
    if (lc.real && lc.winner) return (winMemo[key] = lc.winner);
    const [h, a] = parts(key);
    return (winMemo[key] = mvOf(h) >= mvOf(a) ? h : a);
  }
  const projStage: Record<string, number> = {};
  for (const t of teams) projStage[t.name] = 0;
  for (const c of model.bracket.cards) {
    const depth = ORD[c.round];
    for (const name of parts(`${c.round}-${c.num}`))
      if (name in projStage) projStage[name] = Math.max(projStage[name], depth);
  }
  const projChampion = win("F-1");
  if (projChampion in projStage) projStage[projChampion] = 6;

  // ---- Over/under tracker ----
  const tracker: TrackerRow[] = [...teams]
    .sort((a, b) => b.mv - a.mv)
    .map((t) => {
      const exp = model.expected[t.name];
      const teamMatches = results.ko.filter((m) => m.home === t.name || m.away === t.name);
      let actualStage: number | null = null;
      let alive = false;
      let decided = false;

      if (teamMatches.length) {
        const deepest = teamMatches.reduce((a, m) => (ORD[m.round] > ORD[a.round] ? m : a));
        const r = ORD[deepest.round];
        const played = deepest.hs !== null && deepest.as !== null;
        const wonHere =
          played &&
          deepest.hs !== deepest.as &&
          ((deepest.home === t.name && (deepest.hs as number) > (deepest.as as number)) ||
            (deepest.away === t.name && (deepest.as as number) > (deepest.hs as number)));
        const advanced = appearsDeeperThan(t.name, r) || wonHere;
        if (deepest.round === "F" && advanced) {
          actualStage = 6;
          decided = true;
        } else if (advanced) {
          actualStage = r + 1;
          alive = true;
        } else if (played) {
          actualStage = r;
          decided = true;
        } else {
          actualStage = r;
          alive = true;
        }
      } else {
        const grp = results.groups[t.group];
        if (grp?.complete) {
          actualStage = 0;
          decided = true;
        } else if (results.started) {
          actualStage = 0;
          alive = true;
        }
      }

      const status: TrackerStatus =
        actualStage === null
          ? "pending"
          : actualStage === 6
            ? "champion"
            : alive
              ? "alive"
              : actualStage > exp.stage
                ? "over"
                : actualStage < exp.stage
                  ? "under"
                  : "met";

      const ps = projStage[t.name] ?? 0;
      const achieved = !alive && actualStage !== null && actualStage === ps;
      const projState: TrackerRow["projState"] = ps === 0 ? "out" : achieved ? "done" : "proj";

      return {
        team: lite(t.name),
        rank: exp.rank,
        expStage: exp.stage,
        expLabel: exp.label,
        actualStage,
        actualLabel: actualStage === null ? "Yet to play" : STAGE_LABEL[actualStage],
        status,
        delta: decided ? (actualStage as number) - exp.stage : null,
        alive,
        projStage: ps,
        projLabel: STAGE_LABEL[ps],
        projState,
      };
    });

  // ---- Third-placed race as a ranked list (top eight advance) ----
  const thirdPlace: ThirdPlaceRow[] = thirdRanked.map((t, i) => ({
    team: lite(t.name),
    group: t.g,
    pos: i + 1,
    pl: t.pl,
    gd: t.gd,
    gf: t.gf,
    pts: t.pts,
    qualified: officialThirds ? officialThirds.has(t.g) : i < 8,
    predicted: t.predicted,
  }));

  // ---- Live group tables (real where played, predicted otherwise) ----

  // Each team's expected position within its group = its value rank in the group.
  const expPosByGroup: Record<string, Record<string, number>> = {};
  for (const [g, rows] of predGroups) {
    expPosByGroup[g] = {};
    rows.forEach((r, i) => (expPosByGroup[g][r.team.name] = i + 1));
  }

  const liveGroups: Record<string, { live: boolean; rows: LiveGroupRow[] }> = {};
  for (const g of GROUPS) {
    const rd = results.groups[g];
    if (rd?.anyPlayed && rd.rows.length) {
      // Order by real pts/GD/GF; remaining ties fall to TM's published rank, which
      // already applies the official FIFA tie-breaks (head-to-head → fair play →
      // lots). Teams yet to kick off stay in market-value (seeding) order.
      const sorted = [...rd.rows].sort(byStanding);
      liveGroups[g] = {
        live: true,
        rows: sorted.map((r, i) => {
          const pos = i + 1;
          const expPos = expPosByGroup[g]?.[r.name] ?? i + 1;
          return {
            team: lite(r.name),
            pos,
            pl: r.played,
            gd: r.gd,
            pts: r.pts,
            cls: i < 2 ? "q" : i === 2 && qualGroups.has(g) ? "q3" : "ko",
            predicted: false,
            expPos,
            // Points behind/ahead of whoever currently sits in this team's value-seeded slot.
            delta: r.played > 0 ? r.pts - (sorted[expPos - 1]?.pts ?? r.pts) : null,
          };
        }),
      };
    } else {
      liveGroups[g] = {
        live: false,
        rows: (predGroups.get(g) ?? []).map((r, i) => ({
          team: r.team,
          pos: i + 1,
          pl: 0,
          gd: "—",
          pts: r.pts,
          cls: r.cls,
          predicted: true,
          expPos: i + 1,
          delta: null,
        })),
      };
    }
  }

  return {
    model,
    started: results.started,
    fetchedAt: results.fetchedAt,
    tracker,
    cardByKey,
    liveGroups,
    thirdPlace,
  };
}
