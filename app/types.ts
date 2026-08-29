import type { CeapiGame, RecentGameStats } from "@/lib/player-aggregation";

export interface TeamStats {
  name: string;
  league: string;
  country: string;
  leaguePosition: number;
  wins: number;
  draws: number;
  losses: number;
  goalsScored: number;
  goalsConceded: number;
  goalDiff: number;
  points: number;
  logoUrl: string;
  clubUrl: string;
  clubId: string;
}

export interface QualifiedTeam {
  name: string;
  league: string;
  country: string;
  leaguePosition: number;
  criteria: string[];
  stats: {
    points: number;
    goalDiff: number;
    goalsScored: number;
    goalsConceded: number;
  };
  logoUrl: string;
  clubUrl: string;
  clubId: string;
}

export interface PeriodAnalysis {
  period: number;
  teamsAnalyzed: number;
  leaders: {
    top: {
      points: { value: number; teams: string[] };
      goalDiff: { value: number; teams: string[] };
      goalsScored: { value: number; teams: string[] };
      goalsConceded: { value: number; teams: string[] };
    };
    bottom: {
      points: { value: number; teams: string[] };
      goalDiff: { value: number; teams: string[] };
      goalsScored: { value: number; teams: string[] };
      goalsConceded: { value: number; teams: string[] };
    };
  };
  topTeams: QualifiedTeam[];
  bottomTeams: QualifiedTeam[];
  hasMatch: boolean;
}

export interface AggregatedTeam {
  name: string;
  league: string;
  leaguePosition: number;
  logoUrl: string;
  clubUrl: string;
  clubId: string;
  count: number;
  entries: { category: string; period: number; value: number }[];
  stats: {
    points: number;
    goalDiff: number;
    goalsScored: number;
    goalsConceded: number;
  };
}

export interface AnalysisResult {
  success: boolean;
  matchedPeriod: number | null;
  analysis: PeriodAnalysis[];
  aggregatedTop: AggregatedTeam[];
  aggregatedBottom: AggregatedTeam[];
  allTeamsPerPeriod?: { period: number; teams: TeamStats[] }[];
}

export interface ManagerTrivia {
  name: string;
  profileUrl: string;
  ppg: number;
  matches: number;
  years: string; // e.g., "2015-2018"
}

export interface ManagerInfo {
  name: string;
  profileUrl: string;
  appointedDate?: string;
  matches: number;
  ppg: number | null; // null if no matches or "-" in data
  isCurrentManager: boolean;
  ppgRank?: number; // rank among managers with >= matches since 1992 (1 = best)
  totalComparableManagers?: number; // how many managers qualify for comparison
  bestManager?: ManagerTrivia; // best PPG among comparable managers
  worstManager?: ManagerTrivia; // worst PPG among comparable managers
  officialOnly?: boolean; // PPG/matches count competitive games only (friendlies stripped)
}

export interface InjuredPlayer {
  name: string;
  position: string;
  club: string;
  clubLogoUrl: string;
  injury: string;
  returnDate: string;
  injurySince: string;
  age?: number;
  marketValue: string;
  marketValueNum: number;
  imageUrl: string;
  profileUrl: string;
  league: string;
}

export interface TeamFormEntry {
  name: string;
  league: string;
  leaguePosition: number;
  points: number;
  marketValue: string;
  marketValueNum: number;
  marketValueRank: number;
  expectedPoints: number;
  deltaPts: number;
  logoUrl: string;
  clubUrl: string;
  clubId: string;
  manager?: ManagerInfo | null;
}

export interface PlayerStats {
  name: string;
  position: string;
  age: number;
  club: string;
  clubLogoUrl: string;
  league: string;
  matches: number;
  goals: number;
  assists: number;
  penaltyGoals: number;
  penaltyMisses: number;
  intlGoals: number;
  intlAssists: number;
  intlMinutes: number;
  intlAppearances: number;
  intlPenaltyGoals: number;
  points: number;
  marketValue: number;
  marketValueDisplay: string;
  profileUrl: string;
  imageUrl: string;
  playerId: string;
  minutes?: number;
  intlCareerCaps?: number;
  playedPosition?: string;
  isNewSigning?: boolean;
  isOnLoan?: boolean;
  outperformedByCount?: number;
  nationality?: string;
  nationalityFlagUrl?: string;
}

export interface MinutesValuePlayer {
  name: string;
  position: string;
  age: number;
  club: string;
  clubLogoUrl: string;
  league: string;
  nationality: string;
  marketValue: number;
  marketValueDisplay: string;
  minutes: number;
  totalMatches: number;
  goals: number;
  assists: number;
  penaltyGoals: number;
  penaltyMisses: number;
  intlGoals: number;
  intlAssists: number;
  intlMinutes: number;
  intlAppearances: number;
  intlPenaltyGoals: number;
  intlCareerCaps: number;
  isCurrentIntl?: boolean;
  imageUrl: string;
  profileUrl: string;
  playerId: string;
  playedPosition?: string;
  isNewSigning?: boolean;
  isOnLoan?: boolean;
  contractExpiry?: string;
  gamesMissed?: number;
  totalGames?: number;
  positionStats?: {
    positionId: number;
    position: string;
    minutes: number;
    goals: number;
    assists: number;
    appearances: number;
  }[];
  nationalityFlagUrl?: string;
  leagueLogoUrl?: string;
  recentForm?: RecentGameStats[];
  rawGames?: CeapiGame[];
  fetchedAt?: number;
}

export type InjuryMap = Record<string, { injury: string; returnDate: string; injurySince: string }>;

export interface MarketValueMover {
  name: string;
  position: string;
  age: number;
  club: string;
  clubLogoUrl: string;
  nationality: string;
  currentValue: number;
  previousValue: number;
  absoluteChange: number;
  relativeChange: number;
  imageUrl: string;
  profileUrl: string;
  playerId: string;
  period: string;
}

export interface MarketValueMoversResult {
  repeatMovers: MarketValueMover[][];
  periods: { date: string; movers: MarketValueMover[] }[];
}

// The pipeline wire types (CeapiGame, PlayerStatsResult, RecentGameStats)
// live with the pure aggregation module in lib/player-aggregation.ts and are
// re-exported below so existing app-side imports keep working.
export type { CeapiGame, PlayerStatsResult, RecentGameStats } from "@/lib/player-aggregation";

export interface TransferClub {
  name: string;
  clubId: string;
  logoUrl: string;
  league: string;
  country: string;
}

export interface TopTransfer {
  rank: number;
  playerId: string;
  name: string;
  position: string;
  age: number;
  imageUrl: string;
  nationality: string;
  nationalityFlagUrl: string;
  marketValue: number;
  fee: number;
  feeText: string;
  isLoan: boolean;
  from: TransferClub;
  to: TransferClub;
}

export type TransferBalanceMetric = "expenditure" | "income" | "netSpender" | "netProfit";

export interface TransferBalanceClub {
  id: string;
  slug: string;
  name: string;
  expenditure: number;
  arrivals: number;
  income: number;
  departures: number;
  /** Sales minus spend, straight from Transfermarkt: positive = the club banked money. */
  balance: number;
}

export interface TransferBalanceWindow {
  seasons: number;
  from: number;
  to: number;
  label: string;
  leaders: Record<TransferBalanceMetric, { id: string; name: string; value: number }>;
  /** Every club that holds at least one of the four #1 slots, and which ones. */
  wins: Record<string, TransferBalanceMetric[]>;
  /** Those holding two or more — the thing the page is actually looking for. */
  winners: { id: string; name: string; metrics: TransferBalanceMetric[] }[];
  clubs: TransferBalanceClub[];
}

export interface TransferBalanceResult {
  windows: TransferBalanceWindow[];
}
