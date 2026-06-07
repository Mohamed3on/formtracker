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
import type { WcResults } from "./results";

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
};
export type LiveCard = {
  home: TeamLite;
  away: TeamLite;
  winner: string | null;
  hs: number | null;
  as: number | null;
  real: boolean; // real teams in the slot (vs predicted)
  played: boolean;
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
};

const GROUPS = "ABCDEFGHIJKL".split("");

export function buildLiveModel(teams: Team[], results: WcResults): LiveModel {
  const model = buildModel(teams);
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
    const real = !!(m && m.home && m.away);
    const played = !!(m && m.hs !== null && m.as !== null);
    let winner: string | null = c.winner; // predicted by default
    if (real && m) {
      const r = ORD[c.round];
      if (m.home && appearsDeeperThan(m.home, r)) winner = m.home;
      else if (m.away && appearsDeeperThan(m.away, r)) winner = m.away;
      else if (played && m.hs !== m.as)
        winner = (m.hs as number) > (m.as as number) ? m.home : m.away;
      else winner = null; // real teams set, outcome not yet decided
    }
    cardByKey[key] = {
      home: real ? lite(m!.home!) : c.home,
      away: real ? lite(m!.away!) : c.away,
      winner,
      hs: m?.hs ?? null,
      as: m?.as ?? null,
      real,
      played,
    };
  }

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
      };
    });

  // ---- Live group tables (real where played, predicted otherwise) ----
  const realThirds = GROUPS.flatMap((g) => {
    const rd = results.groups[g];
    if (!rd?.anyPlayed || rd.rows.length < 3) return [];
    const t = [...rd.rows].sort((a, b) => a.rank - b.rank)[2];
    return [{ group: g, pts: t.pts, gd: t.gd, gf: parseInt(t.goals) || 0 }];
  });
  const bestThirdGroups = new Set(
    realThirds
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
      .slice(0, 8)
      .map((t) => t.group),
  );

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
      const sorted = [...rd.rows].sort((a, b) => a.rank - b.rank || b.pts - a.pts || b.gd - a.gd);
      liveGroups[g] = {
        live: true,
        rows: sorted.map((r, i) => {
          const pos = r.rank || i + 1;
          const expPos = expPosByGroup[g]?.[r.name] ?? i + 1;
          return {
            team: lite(r.name),
            pos,
            pl: r.played,
            gd: r.gd,
            pts: r.pts,
            cls: i < 2 ? "q" : i === 2 && bestThirdGroups.has(g) ? "q3" : "ko",
            predicted: false,
            expPos,
            delta: r.played > 0 ? expPos - pos : null,
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
  };
}
