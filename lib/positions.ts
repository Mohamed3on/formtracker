export type PositionClass =
  | "cf"
  | "forward"
  | "attacking-midfield"
  | "central-midfield"
  | "defensive-midfield"
  | "fullback"
  | "other";

const POSITION_CLASS_MAP: Record<string, PositionClass> = {
  "Centre-Forward": "cf",
  "Left Winger": "forward",
  "Right Winger": "forward",
  "Second Striker": "forward",
  "Attacking Midfield": "attacking-midfield",
  "Central Midfield": "central-midfield",
  "Right Midfield": "central-midfield",
  "Left Midfield": "central-midfield",
  "Defensive Midfield": "defensive-midfield",
  "Left-Back": "fullback",
  "Right-Back": "fullback",
  "Left Wing-Back": "fullback",
  "Right Wing-Back": "fullback",
};
const POSITION_CLASS_RANK: Record<PositionClass, number> = {
  other: 1,
  fullback: 2,
  "defensive-midfield": 2,
  "central-midfield": 3,
  "attacking-midfield": 4,
  forward: 5,
  cf: 6,
};
const DEFENSIVE_POSITIONS = new Set<string>([
  "Goalkeeper",
  "Centre-Back",
  "Left-Back",
  "Right-Back",
  "Defensive Midfield",
  "Left Wing-Back",
  "Right Wing-Back",
]);

export type BroadPositionGroup = "forwards" | "midfielders" | "defenders" | "goalkeepers";

const BROAD_POSITION_MAP: Record<string, BroadPositionGroup> = {
  "Centre-Forward": "forwards",
  "Left Winger": "forwards",
  "Right Winger": "forwards",
  "Second Striker": "forwards",
  "Attacking Midfield": "midfielders",
  "Central Midfield": "midfielders",
  "Left Midfield": "midfielders",
  "Right Midfield": "midfielders",
  "Defensive Midfield": "midfielders",
  "Left Wing-Back": "defenders",
  "Right Wing-Back": "defenders",
  "Left-Back": "defenders",
  "Right-Back": "defenders",
  "Centre-Back": "defenders",
  Goalkeeper: "goalkeepers",
};

export function getBroadPositionGroup(position: string): BroadPositionGroup {
  return BROAD_POSITION_MAP[position] ?? "midfielders";
}

const BROAD_POSITION_LABELS: Record<BroadPositionGroup, string> = {
  forwards: "Forwards",
  midfielders: "Midfielders",
  defenders: "Defenders",
  goalkeepers: "Goalkeepers",
};

export function getBroadPositionLabel(position: string): string {
  return BROAD_POSITION_LABELS[getBroadPositionGroup(position)];
}

const BROAD_POSITION_SHORT: Record<BroadPositionGroup, string> = {
  forwards: "FWD",
  midfielders: "MID",
  defenders: "DEF",
  goalkeepers: "GK",
};

/** Shirt-style abbreviations. The squad list shows position, age and market
 *  value on one line, and the full "Centre-Forward" pushed the value out of
 *  the truncated span entirely. Unknown positions pass through unchanged. */
const POSITION_ABBREVIATION: Record<string, string> = {
  Goalkeeper: "GK",
  "Centre-Back": "CB",
  "Left-Back": "LB",
  "Right-Back": "RB",
  "Left Wing-Back": "LWB",
  "Right Wing-Back": "RWB",
  "Defensive Midfield": "DM",
  "Central Midfield": "CM",
  "Left Midfield": "LM",
  "Right Midfield": "RM",
  "Attacking Midfield": "AM",
  "Left Winger": "LW",
  "Right Winger": "RW",
  "Second Striker": "SS",
  "Centre-Forward": "CF",
};

export function getShortPosition(position: string): string {
  return POSITION_ABBREVIATION[position] ?? position;
}

export function getBroadPositionShortLabel(position: string): string {
  return BROAD_POSITION_SHORT[getBroadPositionGroup(position)];
}

/** Maps to the players page ?pos= filter values */
const BROAD_POSITION_FILTER: Record<BroadPositionGroup, string> = {
  forwards: "att",
  midfielders: "mid",
  defenders: "def",
  goalkeepers: "gk",
};

const FILTER_KEYS = new Set<string>(Object.values(BROAD_POSITION_FILTER));

export function getBroadPositionFilter(position: string): string {
  return BROAD_POSITION_FILTER[getBroadPositionGroup(position)];
}

/** Category key for a players-page ?pos= value — either a category key itself
 *  (att/mid/def/gk) or any position name; null when unrecognized. */
export function positionFilterCategory(filter: string): string | null {
  if (FILTER_KEYS.has(filter)) return filter;
  return filter in BROAD_POSITION_MAP ? getBroadPositionFilter(filter) : null;
}

/** Position names under a players-page filter key, for sub-filter dropdowns.
 *  Derived from the same map as filtering, so the two can't disagree. */
export function positionsInFilterCategory(category: string): string[] {
  return Object.keys(BROAD_POSITION_MAP).filter((p) => getBroadPositionFilter(p) === category);
}

/** True when the player belongs under a players-page ?pos= filter — a category
 *  key (att/mid/def/gk) or an exact position name. The single owner of this
 *  rule: profile links built from getBroadPositionFilter and list filtering
 *  must agree, or a player's own profile links to a list that excludes them. */
export function matchesPositionFilter(
  p: { position: string; playedPosition?: string },
  filter: string,
): boolean {
  if (!filter) return true;
  const position = effectivePosition(p);
  if (FILTER_KEYS.has(filter)) return getBroadPositionFilter(position) === filter;
  return position === filter;
}

/** Effective position — prefers the most-played position this season over the registered position. */
export function effectivePosition(p: { playedPosition?: string; position: string }): string {
  return p.playedPosition || p.position;
}

export function getPositionClass(position: string): PositionClass {
  return POSITION_CLASS_MAP[position] ?? "other";
}

export function getPositionClassRank(position: string): number {
  return POSITION_CLASS_RANK[getPositionClass(position)];
}

export function canBeUnderperformerAgainst(
  candidatePosition: string,
  targetPosition: string,
): boolean {
  if (candidatePosition === "Goalkeeper") return false;
  return getPositionClassRank(candidatePosition) >= getPositionClassRank(targetPosition);
}

export function canBeOutperformerAgainst(
  candidatePosition: string,
  targetPosition: string,
): boolean {
  return getPositionClassRank(candidatePosition) <= getPositionClassRank(targetPosition);
}

export function isDefensivePosition(position: string): boolean {
  return DEFENSIVE_POSITIONS.has(position);
}

export function isAttackingPosition(position: string): boolean {
  return getPositionClassRank(position) >= POSITION_CLASS_RANK["attacking-midfield"];
}

/** `a` got equal or better output in equal or fewer minutes, with at least one strictly better. Falls back to strict points comparison when either side has no minutes data. */
export function strictlyOutperforms(
  a: { points: number; minutes?: number },
  b: { points: number; minutes?: number },
): boolean {
  if (a.minutes === undefined || b.minutes === undefined) return a.points > b.points;
  return (
    a.points >= b.points && a.minutes <= b.minutes && (a.points > b.points || a.minutes < b.minutes)
  );
}
