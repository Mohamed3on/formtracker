import type { InjuredPlayer, InjuryMap } from "@/app/types";
import { extractClubIdFromLogoUrl, getPlayerIdFromProfileUrl } from "@/lib/format";

// Priority-ordered: first regex match wins, so body-part-specific rules come before generic ones
const INJURY_CATEGORY_RULES: [string, RegExp][] = [
  ["Hamstring", /hamstring/i],
  ["Knee", /knee|cruciate|meniscus|cartilage/i],
  ["Ankle", /ankle|syndesmotic/i],
  ["Calf", /\bcalf\b/i],
  ["Achilles", /achilles/i],
  ["Foot", /\bfoot\b|metatarsal|plantar|\bheel\b/i],
  ["Thigh", /thigh|dead leg/i],
  ["Groin & Adductor", /groin|adductor|pubalgia|inguinal/i],
  ["Hip & Back", /\bhip\b|\bback\b|lumbago/i],
  ["Lower Leg", /fibula|tibia|lower leg/i],
  [
    "Head & Upper Body",
    /shoulder|collarbone|\brib\b|\bjaw\b|cheekbone|\bhand\b|\belbow\b|thumb|scaphoid|concussion/i,
  ],
  ["Muscle", /muscle|muscular|\bstrain\b/i],
  ["Ligament & Tendon", /ligament|capsular|tendon/i],
  ["Illness & Fitness", /\bill\b|virus|fitness|stomach/i],
  ["Surgery", /\bsurgery\b|arthroscopy/i],
];

export function categorizeInjury(injury: string): string {
  for (const [category, pattern] of INJURY_CATEGORY_RULES) {
    if (pattern.test(injury)) return category;
  }
  return "Other";
}

/** Index injured players by Transfermarkt playerId → their injury detail. */
export function buildInjuryMap(players: InjuredPlayer[]): InjuryMap {
  const map: InjuryMap = {};
  for (const p of players) {
    const id = getPlayerIdFromProfileUrl(p.profileUrl);
    if (id) map[id] = { injury: p.injury, returnDate: p.returnDate, injurySince: p.injurySince };
  }
  return map;
}

export interface TeamInjuryGroup {
  club: string;
  clubLogoUrl: string;
  league: string;
  players: InjuredPlayer[];
  totalValue: number;
  count: number;
}

export function groupPlayersByClub(players: InjuredPlayer[]): TeamInjuryGroup[] {
  const groupMap = new Map<string, TeamInjuryGroup>();

  for (const player of players) {
    const existing = groupMap.get(player.club);
    if (existing) {
      existing.players.push(player);
      existing.totalValue += player.marketValueNum;
      existing.count++;
    } else {
      groupMap.set(player.club, {
        club: player.club,
        clubLogoUrl: player.clubLogoUrl,
        league: player.league,
        players: [player],
        totalValue: player.marketValueNum,
        count: 1,
      });
    }
  }

  return Array.from(groupMap.values());
}

export type WorstHitReason = "count" | "value" | "both" | null;
export type WorstHitScope = "top5" | "league" | null;

export interface WorstHitResult {
  reason: WorstHitReason;
  scope: WorstHitScope;
}

function getReasonFromGroups(clubId: string, groups: TeamInjuryGroup[]): WorstHitReason {
  const mine = groups.find((g) => extractClubIdFromLogoUrl(g.clubLogoUrl) === clubId);
  if (!mine) return null;

  const maxCount = Math.max(...groups.map((g) => g.count));
  const maxValue = Math.max(...groups.map((g) => g.totalValue));
  const isCount = mine.count === maxCount;
  const isValue = mine.totalValue === maxValue;

  if (isCount && isValue) return "both";
  if (isCount) return "count";
  if (isValue) return "value";
  return null;
}

/** Check if clubId is the worst-hit team — first across all top 5 leagues, then within its league */
export function getWorstHitResult(
  clubId: string,
  clubInjuries: InjuredPlayer[],
  allPlayers: InjuredPlayer[],
): WorstHitResult {
  if (clubInjuries.length === 0) return { reason: null, scope: null };

  const allGroups = groupPlayersByClub(allPlayers);
  const top5Reason = getReasonFromGroups(clubId, allGroups);
  if (top5Reason) return { reason: top5Reason, scope: "top5" };

  const league = clubInjuries[0].league;
  const leagueGroups = allGroups.filter((g) => g.league === league);
  const leagueReason = getReasonFromGroups(clubId, leagueGroups);
  if (leagueReason) return { reason: leagueReason, scope: "league" };

  return { reason: null, scope: null };
}
