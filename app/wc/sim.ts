// Deterministic "higher market value always wins" World Cup 2026 model.
// Pure module (no React) — computed once at import, identical on server & client.
//
// Rules:
//  - Every match is won by the team with the higher squad market value. No draws.
//  - Group standings = MV order within the group (9/6/3/0 pts).
//  - The 8 best third-placed teams = the 8 highest-MV third-placed teams.
//  - Those 8 fill the Round of 32 by solving the bracket's allowed-group constraints.

type Team = { name: string; group: string; mv: number; flag: string };

const TEAMS: Team[] = [
  { group: "A", name: "Mexico", mv: 191.85, flag: "🇲🇽" },
  { group: "A", name: "Czechia", mv: 188.18, flag: "🇨🇿" },
  { group: "A", name: "South Korea", mv: 139.05, flag: "🇰🇷" },
  { group: "A", name: "South Africa", mv: 49.25, flag: "🇿🇦" },

  { group: "B", name: "Switzerland", mv: 332.5, flag: "🇨🇭" },
  { group: "B", name: "Canada", mv: 196.65, flag: "🇨🇦" },
  { group: "B", name: "Bosnia-Herzegovina", mv: 151.6, flag: "🇧🇦" },
  { group: "B", name: "Qatar", mv: 19.93, flag: "🇶🇦" },

  { group: "C", name: "Brazil", mv: 923.2, flag: "🇧🇷" },
  { group: "C", name: "Morocco", mv: 498.3, flag: "🇲🇦" },
  { group: "C", name: "Scotland", mv: 170.25, flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { group: "C", name: "Haiti", mv: 55.9, flag: "🇭🇹" },

  { group: "D", name: "Turkiye", mv: 473.7, flag: "🇹🇷" },
  { group: "D", name: "United States", mv: 385.65, flag: "🇺🇸" },
  { group: "D", name: "Paraguay", mv: 153.65, flag: "🇵🇾" },
  { group: "D", name: "Australia", mv: 77.45, flag: "🇦🇺" },

  { group: "E", name: "Germany", mv: 947.0, flag: "🇩🇪" },
  { group: "E", name: "Ivory Coast", mv: 522.1, flag: "🇨🇮" },
  { group: "E", name: "Ecuador", mv: 368.7, flag: "🇪🇨" },
  { group: "E", name: "Curaçao", mv: 25.78, flag: "🇨🇼" },

  { group: "F", name: "Netherlands", mv: 804.2, flag: "🇳🇱" },
  { group: "F", name: "Sweden", mv: 406.08, flag: "🇸🇪" },
  { group: "F", name: "Japan", mv: 270.85, flag: "🇯🇵" },
  { group: "F", name: "Tunisia", mv: 69.95, flag: "🇹🇳" },

  { group: "G", name: "Belgium", mv: 547.5, flag: "🇧🇪" },
  { group: "G", name: "Egypt", mv: 116.48, flag: "🇪🇬" },
  { group: "G", name: "New Zealand", mv: 34.35, flag: "🇳🇿" },
  { group: "G", name: "Iran", mv: 32.05, flag: "🇮🇷" },

  { group: "H", name: "Spain", mv: 1220, flag: "🇪🇸" },
  { group: "H", name: "Uruguay", mv: 359.3, flag: "🇺🇾" },
  { group: "H", name: "Cape Verde", mv: 54.5, flag: "🇨🇻" },
  { group: "H", name: "Saudi Arabia", mv: 40.68, flag: "🇸🇦" },

  { group: "I", name: "France", mv: 1520, flag: "🇫🇷" },
  { group: "I", name: "Norway", mv: 589.9, flag: "🇳🇴" },
  { group: "I", name: "Senegal", mv: 478.1, flag: "🇸🇳" },
  { group: "I", name: "Iraq", mv: 21.2, flag: "🇮🇶" },

  { group: "J", name: "Argentina", mv: 782.5, flag: "🇦🇷" },
  { group: "J", name: "Algeria", mv: 256.9, flag: "🇩🇿" },
  { group: "J", name: "Austria", mv: 242.2, flag: "🇦🇹" },
  { group: "J", name: "Jordan", mv: 20.0, flag: "🇯🇴" },

  { group: "K", name: "Portugal", mv: 1010, flag: "🇵🇹" },
  { group: "K", name: "Colombia", mv: 302.35, flag: "🇨🇴" },
  { group: "K", name: "DR Congo", mv: 143.9, flag: "🇨🇩" },
  { group: "K", name: "Uzbekistan", mv: 85.33, flag: "🇺🇿" },

  { group: "L", name: "England", mv: 1360, flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { group: "L", name: "Croatia", mv: 387.3, flag: "🇭🇷" },
  { group: "L", name: "Ghana", mv: 234.6, flag: "🇬🇭" },
  { group: "L", name: "Panama", mv: 34.55, flag: "🇵🇦" },
];

const SHORT: Record<string, string> = {
  "United States": "USA",
  "Bosnia-Herzegovina": "Bosnia",
  "South Korea": "S. Korea",
  "South Africa": "S. Africa",
};
const sn = (t: Team) => SHORT[t.name] ?? t.name;

const GROUPS = "ABCDEFGHIJKL".split("");
export const fmt = (mv: number) =>
  mv >= 1000 ? `€${(mv / 1000).toFixed(2)}bn` : `€${mv.toFixed(2)}m`;
export const fmtS = (mv: number) =>
  mv >= 1000 ? `€${(mv / 1000).toFixed(2)}bn` : `€${Math.round(mv)}m`;

// ---- Group stage (standings = MV order) ----
const standings: Record<string, Team[]> = {};
for (const g of GROUPS)
  standings[g] = TEAMS.filter((t) => t.group === g).sort((a, b) => b.mv - a.mv);
const winner = (g: string) => standings[g][0];
const runner = (g: string) => standings[g][1];
const third = (g: string) => standings[g][2];

// ---- 8 best third-placed teams (by MV) ----
const qualifiedThirds = GROUPS.map(third)
  .sort((a, b) => b.mv - a.mv)
  .slice(0, 8);
const qualSet = new Set(qualifiedThirds.map((t) => t.group));

// ---- Slot the qualifying thirds into the Round of 32 ----
const SLOT_ALLOWED: Record<number, string[]> = {
  2: ["A", "B", "C", "D", "F"],
  5: ["C", "D", "F", "G", "H"],
  7: ["C", "E", "F", "H", "I"],
  8: ["E", "H", "I", "J", "K"],
  9: ["B", "E", "F", "I", "J"],
  10: ["A", "E", "H", "I", "J"],
  13: ["E", "F", "G", "I", "J"],
  15: ["D", "E", "I", "J", "L"],
};
const SLOTS = [2, 5, 7, 8, 9, 10, 13, 15];
const assign: Record<number, string> = {};
(function solve(i: number, used: Set<string>): boolean {
  if (i === SLOTS.length) return true;
  const slot = SLOTS[i];
  for (const g of SLOT_ALLOWED[slot].filter((x) => qualSet.has(x)).sort()) {
    if (used.has(g)) continue;
    assign[slot] = g;
    used.add(g);
    if (solve(i + 1, used)) return true;
    used.delete(g);
    delete assign[slot];
  }
  return false;
})(0, new Set());
const thirdAt = (slot: number) => third(assign[slot]);

// ---- Knockout as a binary tree (higher MV advances) ----
const beat = (a: Team, b: Team) => (a.mv >= b.mv ? a : b);
const loseT = (a: Team, b: Team) => (a.mv >= b.mv ? b : a);

type Round = "R32" | "R16" | "QF" | "SF" | "F";
type MNode = {
  id: string;
  round: Round;
  home: Team;
  away: Team;
  winner: Team;
  loser: Team;
  kids?: [MNode, MNode];
  col: number;
  x: number;
  y: number;
};
let idc = 0;
const leaf = (round: Round, home: Team, away: Team): MNode => ({
  id: `m${idc++}`,
  round,
  home,
  away,
  winner: beat(home, away),
  loser: loseT(home, away),
  col: 0,
  x: 0,
  y: 0,
});
const node = (round: Round, a: MNode, b: MNode): MNode => ({
  id: `m${idc++}`,
  round,
  home: a.winner,
  away: b.winner,
  winner: beat(a.winner, b.winner),
  loser: loseT(a.winner, b.winner),
  kids: [a, b],
  col: 0,
  x: 0,
  y: 0,
});

const r32: Record<number, MNode> = {
  1: leaf("R32", runner("A"), runner("B")),
  2: leaf("R32", winner("E"), thirdAt(2)),
  3: leaf("R32", winner("F"), runner("C")),
  4: leaf("R32", winner("C"), runner("F")),
  5: leaf("R32", winner("I"), thirdAt(5)),
  6: leaf("R32", runner("E"), runner("I")),
  7: leaf("R32", winner("A"), thirdAt(7)),
  8: leaf("R32", winner("L"), thirdAt(8)),
  9: leaf("R32", winner("D"), thirdAt(9)),
  10: leaf("R32", winner("G"), thirdAt(10)),
  11: leaf("R32", runner("K"), runner("L")),
  12: leaf("R32", winner("H"), runner("J")),
  13: leaf("R32", winner("B"), thirdAt(13)),
  14: leaf("R32", winner("J"), runner("H")),
  15: leaf("R32", winner("K"), thirdAt(15)),
  16: leaf("R32", runner("D"), runner("G")),
};
const r16 = {
  1: node("R16", r32[2], r32[5]),
  2: node("R16", r32[1], r32[3]),
  3: node("R16", r32[4], r32[6]),
  4: node("R16", r32[7], r32[8]),
  5: node("R16", r32[11], r32[12]),
  6: node("R16", r32[9], r32[10]),
  7: node("R16", r32[14], r32[16]),
  8: node("R16", r32[13], r32[15]),
};
const qf = {
  1: node("QF", r16[1], r16[2]),
  2: node("QF", r16[5], r16[6]),
  3: node("QF", r16[7], r16[8]),
  4: node("QF", r16[3], r16[4]),
};
const sf = { 1: node("SF", qf[1], qf[2]), 2: node("SF", qf[4], qf[3]) };
const final = node("F", sf[1], sf[2]);
const champion = final.winner;
const runnerUp = final.loser;
const bronzeM = { home: sf[1].loser, away: sf[2].loser };
const bronze = beat(bronzeM.home, bronzeM.away);
const fourth = loseT(bronzeM.home, bronzeM.away);

// ---- Bracket geometry (two-sided, Final in the centre) ----
const ROW = 82,
  CARD_W = 156,
  CARD_H = 54,
  STEP = 186,
  TOP = 84;
const COL_L: Record<Round, number> = { R32: 0, R16: 1, QF: 2, SF: 3, F: 4 };
const COL_R: Record<Round, number> = { R32: 8, R16: 7, QF: 6, SF: 5, F: 4 };
let slotL = 0,
  slotR = 0;
function layout(n: MNode, side: "L" | "R") {
  n.col = side === "L" ? COL_L[n.round] : COL_R[n.round];
  n.x = n.col * STEP;
  if (!n.kids) {
    const slot = side === "L" ? slotL++ : slotR++;
    n.y = slot * ROW + ROW / 2 + TOP;
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

// ---- Round reached, per team ----
const ORDER: Record<Round, number> = { R32: 1, R16: 2, QF: 3, SF: 4, F: 5 };
const ROUND_NAME: Record<Round, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-finals",
  SF: "Semi-finals",
  F: "Final",
};
const reachRank: Record<string, number> = {};
const reachLabel: Record<string, string> = {};
for (const t of TEAMS) {
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
[...TEAMS]
  .sort((a, b) => bandOf(a) - bandOf(b) || b.mv - a.mv)
  .forEach((t, i) => (finalPos[t.name] = i + 1));

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"],
    v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
const finishCls = (t: Team) => {
  if (t === champion) return "p-champ";
  if (t === runnerUp) return "p-runner";
  if (t === bronze) return "p-third";
  if (t === fourth) return "p-fourth";
  const r = reachRank[t.name];
  return r === 3 ? "p-qf" : r === 2 ? "p-r16" : r === 1 ? "p-r32" : "p-group";
};

// Rounds reached vs the round a team's market-value rank seeds it into.
// Stage scale: groups 0, R32 1, R16 2, QF 3, SF 4, final 5, champion 6.
const actualStage = (t: Team) => (t === champion ? 6 : reachRank[t.name]);
const expectedStage = (rank: number) =>
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

// ---- Serialisable view model ----
export type TeamLite = { name: string; short: string; flag: string; mv: number };
export type Card = {
  id: string;
  round: Round;
  home: TeamLite;
  away: TeamLite;
  winner: string;
  x: number;
  y: number;
  isFinal: boolean;
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

const lite = (t: Team): TeamLite => ({ name: t.name, short: sn(t), flag: t.flag, mv: t.mv });

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

const labels: { label: string; x: number }[] = [
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

const ranked: RankRow[] = [...TEAMS]
  .sort((a, b) => b.mv - a.mv)
  .map((t, i) => {
    const rank = i + 1;
    const pos = finalPos[t.name];
    return {
      rank,
      team: lite(t),
      pos,
      posLabel: ordinal(pos),
      finishLabel: reachLabel[t.name],
      finishCls: finishCls(t),
      delta: actualStage(t) - expectedStage(rank), // rounds over/under expected seeding
    };
  });

export const MODEL = {
  cardW: CARD_W,
  cardH: CARD_H,
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
    cards: allNodes.map((n) => ({
      id: n.id,
      round: n.round,
      home: lite(n.home),
      away: lite(n.away),
      winner: n.winner.name,
      x: n.x,
      y: n.y,
      isFinal: n.round === "F",
    })) as Card[],
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
    rows: standings[g].map(
      (t, i): GroupRow => ({
        team: lite(t),
        w: [3, 2, 1, 0][i],
        l: [0, 1, 2, 3][i],
        pts: [9, 6, 3, 0][i],
        cls: i < 2 ? "q" : i === 2 && qualSet.has(t.group) ? "q3" : "ko",
      }),
    ),
  })),
  info: Object.fromEntries(
    TEAMS.map((t) => [t.name, { flag: t.flag, round: reachLabel[t.name] }]),
  ) as Record<string, { flag: string; round: string }>,
};
