// Deterministic "higher market value always wins" World Cup 2026 model.
// Pure: buildModel(teams) computes groups, bracket, predictions and value-tier
// expectations from a roster + market values. Fed either the static snapshot
// (fallback) or daily-refreshed values from Transfermarkt.

import { ordinal } from "@/lib/format";
import { THIRD_ALLOCATION, THIRD_SLOT_ORDER } from "./third-allocation";

export type Team = { name: string; group: string; mv: number; flag: string; landId: number };
export type TeamLite = { name: string; short: string; flag: string; mv: number };

export type Round = "R32" | "R16" | "QF" | "SF" | "F";
// What feeds a Round-of-32 slot: a group winner/runner-up, or one of the best
// third-placed teams. Lets the schedule explain *why* a projected team sits there.
export type SlotSource =
  | { kind: "winner"; group: string }
  | { kind: "runner"; group: string }
  | { kind: "third" };
export type Card = {
  id: string;
  round: Round;
  num: number; // Transfermarkt match number within the round (Ro32 1..16, etc.)
  home: TeamLite;
  away: TeamLite;
  winner: string;
  x: number;
  y: number;
  isFinal: boolean;
  homeSrc?: SlotSource; // R32 only: which group slot fills this side
  awaySrc?: SlotSource;
};
export type Edge = { d: string; team: string };
export type RankRow = {
  rank: number;
  team: TeamLite;
  pos: number;
  posLabel: string;
  finishLabel: string;
  finishCls: string;
  delta: number;
};
export type GroupRow = { team: TeamLite; w: number; l: number; pts: number; cls: string };
export type Expected = { rank: number; stage: number; label: string };

// Stable roster: groups + flags are final (draw is done); mv is a fallback snapshot.
// landId = Transfermarkt country id (stable; also embedded in player flag URLs),
// used to link a nation to its players on /players regardless of name spelling.
export const BASE_TEAMS: Team[] = [
  { group: "A", name: "Mexico", mv: 191.85, flag: "🇲🇽", landId: 110 },
  { group: "A", name: "Czechia", mv: 188.18, flag: "🇨🇿", landId: 172 },
  { group: "A", name: "South Korea", mv: 139.05, flag: "🇰🇷", landId: 87 },
  { group: "A", name: "South Africa", mv: 49.25, flag: "🇿🇦", landId: 159 },
  { group: "B", name: "Switzerland", mv: 332.5, flag: "🇨🇭", landId: 148 },
  { group: "B", name: "Canada", mv: 196.65, flag: "🇨🇦", landId: 80 },
  { group: "B", name: "Bosnia-Herzegovina", mv: 151.6, flag: "🇧🇦", landId: 24 },
  { group: "B", name: "Qatar", mv: 19.93, flag: "🇶🇦", landId: 137 },
  { group: "C", name: "Brazil", mv: 923.2, flag: "🇧🇷", landId: 26 },
  { group: "C", name: "Morocco", mv: 498.3, flag: "🇲🇦", landId: 107 },
  { group: "C", name: "Scotland", mv: 170.25, flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", landId: 190 },
  { group: "C", name: "Haiti", mv: 55.9, flag: "🇭🇹", landId: 62 },
  { group: "D", name: "Turkiye", mv: 473.7, flag: "🇹🇷", landId: 174 },
  { group: "D", name: "United States", mv: 385.65, flag: "🇺🇸", landId: 184 },
  { group: "D", name: "Paraguay", mv: 153.65, flag: "🇵🇾", landId: 132 },
  { group: "D", name: "Australia", mv: 77.45, flag: "🇦🇺", landId: 12 },
  { group: "E", name: "Germany", mv: 947.0, flag: "🇩🇪", landId: 40 },
  { group: "E", name: "Ivory Coast", mv: 522.1, flag: "🇨🇮", landId: 38 },
  { group: "E", name: "Ecuador", mv: 368.7, flag: "🇪🇨", landId: 44 },
  { group: "E", name: "Curaçao", mv: 25.78, flag: "🇨🇼", landId: 260 },
  { group: "F", name: "Netherlands", mv: 804.2, flag: "🇳🇱", landId: 122 },
  { group: "F", name: "Sweden", mv: 406.08, flag: "🇸🇪", landId: 147 },
  { group: "F", name: "Japan", mv: 270.85, flag: "🇯🇵", landId: 77 },
  { group: "F", name: "Tunisia", mv: 69.95, flag: "🇹🇳", landId: 173 },
  { group: "G", name: "Belgium", mv: 547.5, flag: "🇧🇪", landId: 19 },
  { group: "G", name: "Egypt", mv: 116.48, flag: "🇪🇬", landId: 2 },
  { group: "G", name: "New Zealand", mv: 34.35, flag: "🇳🇿", landId: 120 },
  { group: "G", name: "Iran", mv: 32.05, flag: "🇮🇷", landId: 71 },
  { group: "H", name: "Spain", mv: 1220, flag: "🇪🇸", landId: 157 },
  { group: "H", name: "Uruguay", mv: 359.3, flag: "🇺🇾", landId: 179 },
  { group: "H", name: "Cape Verde", mv: 54.5, flag: "🇨🇻", landId: 32 },
  { group: "H", name: "Saudi Arabia", mv: 40.68, flag: "🇸🇦", landId: 146 },
  { group: "I", name: "France", mv: 1520, flag: "🇫🇷", landId: 50 },
  { group: "I", name: "Norway", mv: 589.9, flag: "🇳🇴", landId: 125 },
  { group: "I", name: "Senegal", mv: 478.1, flag: "🇸🇳", landId: 149 },
  { group: "I", name: "Iraq", mv: 21.2, flag: "🇮🇶", landId: 70 },
  { group: "J", name: "Argentina", mv: 782.5, flag: "🇦🇷", landId: 9 },
  { group: "J", name: "Algeria", mv: 256.9, flag: "🇩🇿", landId: 4 },
  { group: "J", name: "Austria", mv: 242.2, flag: "🇦🇹", landId: 127 },
  { group: "J", name: "Jordan", mv: 20.0, flag: "🇯🇴", landId: 78 },
  { group: "K", name: "Portugal", mv: 1010, flag: "🇵🇹", landId: 136 },
  { group: "K", name: "Colombia", mv: 302.35, flag: "🇨🇴", landId: 83 },
  { group: "K", name: "DR Congo", mv: 143.9, flag: "🇨🇩", landId: 193 },
  { group: "K", name: "Uzbekistan", mv: 85.33, flag: "🇺🇿", landId: 180 },
  { group: "L", name: "England", mv: 1360, flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", landId: 189 },
  { group: "L", name: "Croatia", mv: 387.3, flag: "🇭🇷", landId: 37 },
  { group: "L", name: "Ghana", mv: 234.6, flag: "🇬🇭", landId: 54 },
  { group: "L", name: "Panama", mv: 34.55, flag: "🇵🇦", landId: 130 },
];

const SHORT: Record<string, string> = {
  "United States": "USA",
  "Bosnia-Herzegovina": "Bosnia",
  "South Korea": "S. Korea",
  "South Africa": "S. Africa",
};
export const shortName = (name: string) => SHORT[name] ?? name;

// Transfermarkt team names that differ from our stable roster.
const NAME_ALIAS: Record<string, string> = {
  "Democratic Republic of the Congo": "DR Congo",
  // Transfermarkt's fixture/standings tables use short names; map them to the roster.
  USA: "United States",
  Bosnia: "Bosnia-Herzegovina",
};
export const normName = (raw: string) => {
  const s = raw.trim().replace(/\s+/g, " ");
  return NAME_ALIAS[s] ?? s;
};

const GROUPS = "ABCDEFGHIJKL".split("");
const ROUND_NAME: Record<Round, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-finals",
  SF: "Semi-finals",
  F: "Final",
};
const ORDER: Record<Round, number> = { R32: 1, R16: 2, QF: 3, SF: 4, F: 5 };

// Round-of-32 slot provenance (official FIFA 2026 bracket): match number → the
// [home, away] group slots that feed it. "third" takes the best-third-placed team
// allocated to that match number. Mirrors the leaf construction in buildModel.
const R32_SLOTS: Record<number, [SlotSource, SlotSource]> = {
  1: [
    { kind: "runner", group: "A" },
    { kind: "runner", group: "B" },
  ],
  2: [{ kind: "winner", group: "E" }, { kind: "third" }],
  3: [
    { kind: "winner", group: "F" },
    { kind: "runner", group: "C" },
  ],
  4: [
    { kind: "winner", group: "C" },
    { kind: "runner", group: "F" },
  ],
  5: [{ kind: "winner", group: "I" }, { kind: "third" }],
  6: [
    { kind: "runner", group: "E" },
    { kind: "runner", group: "I" },
  ],
  7: [{ kind: "winner", group: "A" }, { kind: "third" }],
  8: [{ kind: "winner", group: "L" }, { kind: "third" }],
  9: [{ kind: "winner", group: "D" }, { kind: "third" }],
  10: [{ kind: "winner", group: "G" }, { kind: "third" }],
  11: [
    { kind: "runner", group: "K" },
    { kind: "runner", group: "L" },
  ],
  12: [
    { kind: "winner", group: "H" },
    { kind: "runner", group: "J" },
  ],
  13: [{ kind: "winner", group: "B" }, { kind: "third" }],
  14: [
    { kind: "winner", group: "J" },
    { kind: "runner", group: "H" },
  ],
  15: [{ kind: "winner", group: "K" }, { kind: "third" }],
  16: [
    { kind: "runner", group: "D" },
    { kind: "runner", group: "G" },
  ],
};

// Value-rank → the round a team is seeded to reach (stage 0 groups .. 6 win).
export const expectedStage = (rank: number) =>
  rank === 1
    ? 6
    : rank === 2
      ? 5
      : rank <= 4
        ? 4
        : rank <= 8
          ? 3
          : rank <= 16
            ? 2
            : rank <= 32
              ? 1
              : 0;
export const STAGE_LABEL = [
  "Group stage",
  "Round of 32",
  "Round of 16",
  "Quarter-finals",
  "Semi-finals",
  "Final",
  "Champions",
];

// Bracket geometry (two-sided, Final in the centre)
const ROW = 82,
  CARD_W = 156,
  CARD_H = 54,
  STEP = 186,
  TOP = 84;

export type WcModel = ReturnType<typeof buildModel>;

export function buildModel(
  teams: Team[],
  live?: {
    order?: Record<string, string[]>;
    qualGroups?: Set<string>;
    // Real knockout results per card key (`${round}-${num}`): TM's drawn sides and the
    // settled winner. Absent (the /wc prediction) → the tree is pure market value.
    ko?: Record<string, { home: string | null; away: string | null; winner: string | null }>;
  },
) {
  const lite = (t: Team): TeamLite => ({
    name: t.name,
    short: shortName(t.name),
    flag: t.flag,
    mv: t.mv,
  });

  // ---- Group stage ----
  // MV order drives the predicted group table and the value-tier expectations.
  // The bracket is seeded from `live.order` where a group has kicked off (real
  // standings); groups/teams that haven't played yet fall back to MV order.
  const byNameTeam = Object.fromEntries(teams.map((t) => [t.name, t])) as Record<string, Team>;
  const mvStandings: Record<string, Team[]> = {};
  for (const g of GROUPS)
    mvStandings[g] = teams.filter((t) => t.group === g).sort((a, b) => b.mv - a.mv);
  const mvQualSet = new Set(
    GROUPS.map((g) => mvStandings[g][2])
      .sort((a, b) => b.mv - a.mv)
      .slice(0, 8)
      .map((t) => t.group),
  );

  const standings: Record<string, Team[]> = {};
  for (const g of GROUPS) {
    const mapped = live?.order?.[g]?.map((n) => byNameTeam[n]).filter(Boolean) as
      | Team[]
      | undefined;
    standings[g] = mapped?.length === 4 ? mapped : mvStandings[g];
  }
  const winner = (g: string) => standings[g][0];
  const runner = (g: string) => standings[g][1];
  const third = (g: string) => standings[g][2];

  // ---- Slot the 8 best third-placed teams into the Round of 32 ----
  // FIFA publishes a fixed table: which eight groups' thirds advance determines
  // exactly which third faces each group winner. Look it up by the sorted
  // combination rather than solving the constraints ourselves — multiple valid
  // matchings exist, but only one is FIFA's (e.g. 3rd-place E goes to the Group A
  // winner, not the Group L winner). A qualifying set is always 8 distinct groups,
  // so it is always one of the table's 495 rows; a miss means the data is broken.
  const qualSet = live?.qualGroups ?? mvQualSet;
  const key = [...qualSet].sort().join("");
  const row = THIRD_ALLOCATION[key];
  if (!row) throw new Error(`no FIFA third-place allocation for qualifying groups: ${key}`);
  const assign: Record<number, string> = Object.fromEntries(
    THIRD_SLOT_ORDER.map((slot, i) => [slot, row[i]]),
  );
  const thirdAt = (slot: number) => third(assign[slot]);

  // ---- Knockout tree (higher MV advances) ----
  const beat = (a: Team, b: Team) => (a.mv >= b.mv ? a : b);
  const loseT = (a: Team, b: Team) => (a.mv >= b.mv ? b : a);

  type MNode = {
    id: string;
    round: Round;
    num: number;
    home: Team;
    away: Team;
    winner: Team;
    loser: Team;
    kids?: [MNode, MNode];
    col: number;
    x: number;
    y: number;
  };
  // Fold real results into the tree: a card's sides come from TM's draw when present
  // (else the feeder winners / group slots), and a settled tie's real winner overrides
  // the value pick. With no `live.ko` (the /wc prediction) this stays pure market value.
  const ko = live?.ko;
  const koTeam = (round: Round, num: number, side: "home" | "away"): Team | undefined => {
    const name = ko?.[`${round}-${num}`]?.[side];
    return name ? byNameTeam[name] : undefined;
  };
  const decide = (round: Round, num: number, home: Team, away: Team) => {
    const w = ko?.[`${round}-${num}`]?.winner;
    if (w === home.name) return { winner: home, loser: away };
    if (w === away.name) return { winner: away, loser: home };
    return { winner: beat(home, away), loser: loseT(home, away) };
  };
  let idc = 0;
  const leaf = (round: Round, num: number, hSlot: Team, aSlot: Team): MNode => {
    const home = koTeam(round, num, "home") ?? hSlot;
    const away = koTeam(round, num, "away") ?? aSlot;
    return {
      id: `m${idc++}`,
      round,
      num,
      home,
      away,
      ...decide(round, num, home, away),
      col: 0,
      x: 0,
      y: 0,
    };
  };
  const node = (round: Round, num: number, a: MNode, b: MNode): MNode => {
    const home = koTeam(round, num, "home") ?? a.winner;
    const away = koTeam(round, num, "away") ?? b.winner;
    return {
      id: `m${idc++}`,
      round,
      num,
      home,
      away,
      ...decide(round, num, home, away),
      kids: [a, b],
      col: 0,
      x: 0,
      y: 0,
    };
  };

  const srcTeam = (num: number, s: SlotSource): Team =>
    s.kind === "winner" ? winner(s.group) : s.kind === "runner" ? runner(s.group) : thirdAt(num);
  const r32 = Object.fromEntries(
    Object.entries(R32_SLOTS).map(([n, [h, a]]) => [
      +n,
      leaf("R32", +n, srcTeam(+n, h), srcTeam(+n, a)),
    ]),
  ) as Record<number, MNode>;
  const r16 = {
    1: node("R16", 1, r32[2], r32[5]),
    2: node("R16", 2, r32[1], r32[3]),
    3: node("R16", 3, r32[4], r32[6]),
    4: node("R16", 4, r32[7], r32[8]),
    5: node("R16", 5, r32[11], r32[12]),
    6: node("R16", 6, r32[9], r32[10]),
    7: node("R16", 7, r32[14], r32[16]),
    8: node("R16", 8, r32[13], r32[15]),
  };
  const qf = {
    1: node("QF", 1, r16[1], r16[2]),
    2: node("QF", 2, r16[5], r16[6]),
    3: node("QF", 3, r16[7], r16[8]),
    4: node("QF", 4, r16[3], r16[4]),
  };
  const sf = { 1: node("SF", 1, qf[1], qf[2]), 2: node("SF", 2, qf[4], qf[3]) };
  const final = node("F", 1, sf[1], sf[2]);

  const champion = final.winner;
  const runnerUp = final.loser;
  const bronzeM = { home: sf[1].loser, away: sf[2].loser };
  const bronze = beat(bronzeM.home, bronzeM.away);
  const fourth = loseT(bronzeM.home, bronzeM.away);

  // ---- Layout ----
  const COL_L: Record<Round, number> = { R32: 0, R16: 1, QF: 2, SF: 3, F: 4 };
  const COL_R: Record<Round, number> = { R32: 8, R16: 7, QF: 6, SF: 5, F: 4 };
  let slotL = 0,
    slotR = 0;
  function layout(n: MNode, side: "L" | "R") {
    n.col = side === "L" ? COL_L[n.round] : COL_R[n.round];
    n.x = n.col * STEP;
    if (!n.kids) {
      n.y = (side === "L" ? slotL++ : slotR++) * ROW + ROW / 2 + TOP;
    } else {
      layout(n.kids[0], side);
      layout(n.kids[1], side);
      n.y = (n.kids[0].y + n.kids[1].y) / 2;
    }
  }
  layout(sf[1], "L");
  layout(sf[2], "R");
  final.col = 4;
  final.x = 4 * STEP;
  final.y = (sf[1].y + sf[2].y) / 2;

  const BRACKET_W = 8 * STEP + CARD_W;
  const BRACKET_H = 8 * ROW + TOP + 60;
  const allNodes: MNode[] = [];
  (function collect(n: MNode) {
    allNodes.push(n);
    n.kids?.forEach(collect);
  })(final);

  // ---- Round reached (predicted) + value-tier expectation, per team ----
  const reachRank: Record<string, number> = {};
  const reachLabel: Record<string, string> = {};
  for (const t of teams) {
    reachRank[t.name] = 0;
    reachLabel[t.name] = "Group stage";
  }
  for (const n of allNodes)
    for (const t of [n.home, n.away])
      if (ORDER[n.round] > reachRank[t.name]) {
        reachRank[t.name] = ORDER[n.round];
        reachLabel[t.name] = ROUND_NAME[n.round];
      }
  reachLabel[champion.name] = "Champions";
  reachLabel[runnerUp.name] = "Runner-up";
  reachLabel[bronze.name] = "Third place";
  reachLabel[fourth.name] = "Fourth place";
  const predictedStage = (t: Team) => (t === champion ? 6 : reachRank[t.name]);

  // ---- Final placement (1..48) ----
  const bandOf = (t: Team) =>
    t === champion
      ? 0
      : t === runnerUp
        ? 1
        : t === bronze
          ? 2
          : t === fourth
            ? 3
            : 7 - reachRank[t.name];
  const finalPos: Record<string, number> = {};
  [...teams]
    .sort((a, b) => bandOf(a) - bandOf(b) || b.mv - a.mv)
    .forEach((t, i) => (finalPos[t.name] = i + 1));

  const finishCls = (t: Team) => {
    if (t === champion) return "p-champ";
    if (t === runnerUp) return "p-runner";
    if (t === bronze) return "p-third";
    if (t === fourth) return "p-fourth";
    const r = reachRank[t.name];
    return r === 3 ? "p-qf" : r === 2 ? "p-r16" : r === 1 ? "p-r32" : "p-group";
  };

  // ---- Render data ----
  const cards: Card[] = allNodes.map((n) => {
    const src = n.round === "R32" ? R32_SLOTS[n.num] : undefined;
    return {
      id: n.id,
      round: n.round,
      num: n.num,
      home: lite(n.home),
      away: lite(n.away),
      winner: n.winner.name,
      x: n.x,
      y: n.y,
      isFinal: n.round === "F",
      homeSrc: src?.[0],
      awaySrc: src?.[1],
    };
  });

  const edges: Edge[] = allNodes
    .filter((n) => n.kids)
    .flatMap((p) =>
      p.kids!.map((k) => {
        const left = k.x < p.x;
        const sx = left ? k.x + CARD_W : k.x;
        const ex = left ? p.x : p.x + CARD_W;
        const mx = (sx + ex) / 2;
        return { d: `M${sx} ${k.y}L${mx} ${k.y}L${mx} ${p.y}L${ex} ${p.y}`, team: k.winner.name };
      }),
    );

  const labels = [
    ["Round of 32", 0],
    ["Round of 16", 1],
    ["Quarter-finals", 2],
    ["Semi-finals", 3],
    ["Final", 4],
    ["Semi-finals", 5],
    ["Quarter-finals", 6],
    ["Round of 16", 7],
    ["Round of 32", 8],
  ].map(([label, c]) => ({ label: label as string, x: (c as number) * STEP }));

  const ranked: RankRow[] = [...teams]
    .sort((a, b) => b.mv - a.mv)
    .map((t, i) => {
      const rank = i + 1;
      return {
        rank,
        team: lite(t),
        pos: finalPos[t.name],
        posLabel: ordinal(finalPos[t.name]),
        finishLabel: reachLabel[t.name],
        finishCls: finishCls(t),
        delta: predictedStage(t) - expectedStage(rank),
      };
    });

  const expected: Record<string, Expected> = {};
  [...teams]
    .sort((a, b) => b.mv - a.mv)
    .forEach((t, i) => {
      const stage = expectedStage(i + 1);
      expected[t.name] = { rank: i + 1, stage, label: STAGE_LABEL[stage] };
    });

  return {
    cardW: CARD_W,
    cardH: CARD_H,
    teams: teams.map(lite),
    podium: [
      { team: lite(champion), word: "Champions", cls: "gold" },
      { team: lite(runnerUp), word: "Runners-up", cls: "silver" },
      { team: lite(bronze), word: "Third place", cls: "bronze" },
      { team: lite(fourth), word: "Fourth place", cls: "iron" },
    ],
    bracket: {
      width: BRACKET_W,
      height: BRACKET_H,
      labels,
      edges,
      cards,
      crown: { x: final.x + CARD_W / 2 - 90, y: final.y - CARD_H / 2 - 128, team: lite(champion) },
      third: {
        x: final.x + CARD_W / 2 - 90,
        y: final.y + CARD_H / 2 + 34,
        home: lite(bronzeM.home),
        away: lite(bronzeM.away),
        winner: bronze.name,
      },
    },
    ranked,
    groups: GROUPS.map((g) => ({
      g,
      rows: mvStandings[g].map(
        (t, i): GroupRow => ({
          team: lite(t),
          w: [3, 2, 1, 0][i],
          l: [0, 1, 2, 3][i],
          pts: [9, 6, 3, 0][i],
          cls: i < 2 ? "q" : i === 2 && mvQualSet.has(t.group) ? "q3" : "ko",
        }),
      ),
    })),
    info: Object.fromEntries(
      teams.map((t) => [t.name, { flag: t.flag, round: reachLabel[t.name] }]),
    ) as Record<string, { flag: string; round: string }>,
    expected,
    byName: Object.fromEntries(teams.map((t) => [t.name, lite(t)])) as Record<string, TeamLite>,
    // Deepest round each team reaches in this (results-aware) tree, 0..6 — the live
    // tracker's projection. Champion is 6; pure market value when no `live.ko` is given.
    reached: Object.fromEntries(teams.map((t) => [t.name, predictedStage(t)])) as Record<
      string,
      number
    >,
  };
}
