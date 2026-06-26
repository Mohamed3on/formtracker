import { Suspense } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ArrowUpDown,
  Clock,
  HeartPulse,
  Scale,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { createPageMetadata } from "@/lib/metadata";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAnalysis } from "@/lib/form-analysis";
import { getTeamFormData, splitPerformers } from "@/lib/team-form";
import {
  applyStatsToggles,
  getMinutesValueData,
  includeTournamentStats,
  toPlayerStats,
} from "@/lib/fetch-minutes-value";
import { findValueCandidates } from "@/lib/value-analysis";
import { getInjuredPlayers } from "@/lib/injured";
import { displayMatches, missedPct, getFormMinutes, getFormNpga } from "@/lib/filter-players";
import {
  extractClubIdFromLogoUrl,
  formatMarketValue,
  getPlayerDetailHref,
  getPlayerIdFromProfileUrl,
  getTeamDetailHref,
} from "@/lib/format";
import { findRepeatLosers, findRepeatWinners } from "@/lib/biggest-movers";
import { getManagerInfo } from "@/lib/fetch-manager";
import { HeroCardSkeleton, StandoutsGridSkeleton } from "@/app/components/HomeSkeletons";
import type {
  AggregatedTeam,
  ManagerInfo,
  MarketValueMover,
  MinutesValuePlayer,
} from "@/app/types";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Football Form, Value & Injury Analytics",
  description:
    "See what the table misses: form swings, value gaps, player output, and injury cost across the Premier League, La Liga, Bundesliga, Serie A, and Ligue 1.",
  path: "/",
  keywords: [
    "football analytics",
    "soccer statistics",
    "team form tracker",
    "player value analysis",
    "injury impact football",
    "transfermarkt analytics",
  ],
});

const MIN_VALUE_ANALYSIS_MINUTES = 260;

type SnapshotTone = "red" | "green";

const SNAPSHOT_TONE_STYLES = {
  red: {
    border: "border-l-red-500/50",
    label: "text-red-400",
    link: "text-red-400",
  },
  green: {
    border: "border-l-emerald-500/50",
    label: "text-emerald-400",
    link: "text-emerald-400",
  },
} as const;

interface SnapshotItem {
  label: string;
  value: string;
  detail: string;
  metrics?: string[];
  href: string;
  imageUrl?: string;
  secondaryImageUrl?: string;
  imageContain?: boolean;
  profileUrl?: string;
  playerId?: string;
  clubId?: string;
  manager?: ManagerInfo;
  tone?: SnapshotTone;
}

interface SnapshotGroup {
  title: string;
  description: string;
  href: string;
  items: SnapshotItem[];
}

interface InjuryTeamSummary {
  club: string;
  league: string;
  clubLogoUrl: string;
  totalValue: number;
  count: number;
}

function aggregatedDetail(team: AggregatedTeam): string {
  const uniqueCategories = [...new Set(team.entries.map((e) => e.category))];
  const topCategories = uniqueCategories.slice(0, 3).join(", ");
  return `${team.league} · ${team.entries.length} categories · ${topCategories}`;
}

function hasManagerRanking(manager: ManagerInfo): manager is ManagerInfo & {
  ppg: number;
  ppgRank: number;
  totalComparableManagers: number;
} {
  return (
    manager.ppg !== null &&
    manager.ppgRank !== undefined &&
    manager.totalComparableManagers !== undefined
  );
}

function ManagerSnapshotBadges({ manager }: { manager: ManagerInfo }) {
  const gamesText = `${manager.matches} ${manager.matches === 1 ? "game" : "games"}`;
  const hasRanking = hasManagerRanking(manager);
  const isOnly = hasRanking && manager.totalComparableManagers === 1;
  const isBest = hasRanking && manager.ppgRank === 1 && !isOnly;
  const isWorst =
    hasRanking && manager.ppgRank === manager.totalComparableManagers && !isBest && !isOnly;

  const ppgClassName = isBest
    ? "border-emerald-500/35 bg-emerald-500/12 text-emerald-300"
    : isWorst
      ? "border-rose-500/35 bg-rose-500/12 text-rose-300"
      : isOnly
        ? "border-sky-500/35 bg-sky-500/12 text-sky-300"
        : "border-border-subtle bg-card text-text-secondary";

  const ppgText =
    manager.matches === 0
      ? "New manager"
      : manager.ppg === null
        ? gamesText
        : hasRanking
          ? `${manager.ppg.toFixed(2)} PPG (${manager.ppgRank}/${manager.totalComparableManagers}) · ${gamesText}`
          : `${manager.ppg.toFixed(2)} PPG · ${gamesText}`;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <a
        href={manager.profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex max-w-full items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition-colors hover:text-text-primary ${manager.isCurrentManager ? "border-accent-blue/35 bg-accent-blue/12 text-accent-blue" : "border-border-subtle bg-card text-text-muted"}`}
      >
        <span className="truncate">Mgr {manager.name}</span>
      </a>
      <span
        className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${ppgClassName}`}
      >
        {ppgText}
      </span>
      {!manager.isCurrentManager && (
        <span className="inline-flex items-center rounded-md border border-rose-500/35 bg-rose-500/12 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
          Sacked
        </span>
      )}
    </div>
  );
}

function SnapshotItemRow({
  item,
  variant = "section",
}: {
  item: SnapshotItem;
  variant?: "hero" | "section";
}) {
  const isHero = variant === "hero";
  const Tag = isHero ? "div" : "article";
  const toneStyles = item.tone ? SNAPSHOT_TONE_STYLES[item.tone] : null;
  return (
    <Tag
      className={`rounded-lg border px-3 py-2 ${
        toneStyles ? `border-l-2 ${toneStyles.border}` : ""
      } ${
        isHero
          ? "border-border-subtle bg-card"
          : "border-border-subtle bg-elevated transition-all duration-200 hover:-translate-y-px hover:bg-card-hover hover:border-border-medium"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <Avatar
            className={`h-10 w-10 border border-border-subtle ${isHero ? "bg-elevated" : "bg-card"}`}
          >
            {item.imageUrl ? (
              <AvatarImage
                src={item.imageUrl}
                alt={item.value}
                className={item.imageContain ? "object-contain bg-white p-1" : undefined}
              />
            ) : (
              <AvatarFallback>{item.value.charAt(0)}</AvatarFallback>
            )}
          </Avatar>
          {item.secondaryImageUrl && (
            <Avatar className="absolute -bottom-1 -right-1 h-5 w-5 border border-border-subtle bg-white">
              <AvatarImage src={item.secondaryImageUrl} alt="" className="object-contain p-px" />
            </Avatar>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={`text-[11px] uppercase tracking-[0.12em] ${toneStyles ? toneStyles.label : "text-text-muted"}`}
          >
            {item.label}
          </p>
          {item.playerId ? (
            <Link
              href={getPlayerDetailHref(item.playerId)}
              className={`truncate font-semibold leading-tight text-text-primary hover:underline ${!isHero ? "mt-0.5 text-sm" : ""} block`}
            >
              {item.value}
            </Link>
          ) : item.clubId ? (
            <Link
              href={getTeamDetailHref(item.clubId)}
              className={`truncate font-semibold leading-tight text-text-primary hover:underline ${!isHero ? "mt-0.5 text-sm" : ""} block`}
            >
              {item.value}
            </Link>
          ) : item.profileUrl ? (
            <a
              href={
                item.profileUrl.startsWith("http")
                  ? item.profileUrl
                  : `https://www.transfermarkt.com${item.profileUrl}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className={`truncate font-semibold leading-tight text-text-primary hover:underline ${!isHero ? "mt-0.5 text-sm" : ""} block`}
            >
              {item.value}
            </a>
          ) : (
            <p
              className={`truncate font-semibold leading-tight text-text-primary ${!isHero ? "mt-0.5 text-sm" : ""}`}
            >
              {item.value}
            </p>
          )}
          <p className={`text-xs leading-tight text-text-secondary ${!isHero ? "mt-0.5" : ""}`}>
            {item.detail}
          </p>
          {item.metrics && item.metrics.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {item.metrics.map((metric) => (
                <span
                  key={metric}
                  className={`rounded-md border border-border-subtle px-1.5 py-0.5 text-[10px] font-medium text-text-secondary ${
                    isHero ? "bg-elevated" : "bg-card"
                  }`}
                >
                  {metric}
                </span>
              ))}
            </div>
          )}
          {item.manager && <ManagerSnapshotBadges manager={item.manager} />}
          <Link
            href={item.href}
            className={`group/link mt-1.5 inline-flex items-center gap-1 text-xs font-semibold transition-colors hover:text-text-primary ${toneStyles ? toneStyles.link : "text-accent-blue"}`}
          >
            Explore
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/link:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </Tag>
  );
}

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function formatMinutes(value?: number): string {
  if (value === undefined) return "0";
  return value.toLocaleString();
}

function getNpga(player: Pick<MinutesValuePlayer, "goals" | "assists" | "penaltyGoals">): number {
  return player.goals - (player.penaltyGoals ?? 0) + player.assists;
}

function sortByNpgaDesc(players: MinutesValuePlayer[]): MinutesValuePlayer[] {
  return [...players].sort((a, b) => {
    const npgaDiff = getNpga(b) - getNpga(a);
    if (npgaDiff !== 0) return npgaDiff;
    return a.minutes - b.minutes;
  });
}

function pickWithTies<T>(
  items: T[],
  metric: (item: T) => number,
  direction: "top" | "bottom",
  opts?: { sort?: (a: T, b: T) => number; max?: number },
): T[] {
  if (items.length === 0) return [];
  const targetValue = items.reduce(
    (acc, item) => {
      const v = metric(item);
      return direction === "top" ? Math.max(acc, v) : Math.min(acc, v);
    },
    direction === "top" ? -Infinity : Infinity,
  );
  const tied = items.filter((item) => metric(item) === targetValue);
  const sorted = opts?.sort ? [...tied].sort(opts.sort) : tied;
  return opts?.max ? sorted.slice(0, opts.max) : sorted;
}

function teamItem(
  team: { name: string; logoUrl: string; clubId?: string },
  label: string,
  href: string,
  detail: string,
  opts?: { metrics?: string[]; tone?: SnapshotTone; manager?: ManagerInfo },
): SnapshotItem {
  return {
    label,
    value: team.name,
    detail,
    href,
    imageUrl: team.logoUrl,
    imageContain: true,
    clubId: team.clubId,
    metrics: opts?.metrics,
    manager: opts?.manager,
    tone: opts?.tone,
  };
}

function playerItem(
  player: {
    name: string;
    imageUrl: string;
    clubLogoUrl: string;
    profileUrl: string;
    playerId?: string;
  },
  label: string,
  href: string,
  detail: string,
  opts?: { metrics?: string[]; tone?: SnapshotTone },
): SnapshotItem {
  return {
    label,
    value: player.name,
    detail,
    href,
    imageUrl: player.imageUrl,
    secondaryImageUrl: player.clubLogoUrl,
    profileUrl: player.profileUrl,
    playerId: player.playerId || getPlayerIdFromProfileUrl(player.profileUrl) || undefined,
    metrics: opts?.metrics,
    tone: opts?.tone,
  };
}

type FeatureTone = {
  card: string;
  iconWrap: string;
  icon: string;
  tag: string;
  bullet: string;
  link: string;
};

type Feature = {
  title: string;
  href: string;
  tag: string;
  description: string;
  highlights: readonly [string, string, string];
  icon: LucideIcon;
  tone: FeatureTone;
};

const features: readonly Feature[] = [
  {
    title: "Recent Form",
    href: "/form",
    tag: "Momentum",
    description: "Compare 5, 10, 15, and 20-match windows to spot momentum shifts early.",
    highlights: [
      "Best and worst teams by points, goal difference, scoring, and defense",
      "See how form shifts across 5, 10, 15, and 20-match windows",
      "Manager points-per-game ranking for context",
    ],
    icon: Activity,
    tone: {
      card: "hover:border-accent-hot-border",
      iconWrap: "bg-accent-hot-glow",
      icon: "text-accent-hot",
      tag: "border-accent-hot-border text-accent-hot",
      bullet: "bg-accent-hot",
      link: "text-accent-hot",
    },
  },
  {
    title: "Value vs Table",
    href: "/expected-position",
    tag: "Expectation Gap",
    description:
      "Rank squads by market value, compare to actual league standings, and see who's punching above or below their weight.",
    highlights: [
      "See which teams are beating or trailing their spending expectations",
      "Filter by league or view all five at once",
      "Manager record shown alongside each team",
    ],
    icon: Scale,
    tone: {
      card: "hover:border-accent-blue/35",
      iconWrap: "bg-accent-blue/15",
      icon: "text-accent-blue",
      tag: "border-accent-blue/35 text-accent-blue",
      bullet: "bg-accent-blue",
      link: "text-accent-blue",
    },
  },
  {
    title: "Player Explorer",
    href: "/players",
    tag: "Scouting Filters",
    description: "Filter 500+ players by value, output, minutes, loans, new signings, and more.",
    highlights: [
      "Find loans and new signings across Europe's top 5 leagues",
      "Filter by league, club, nationality, or position",
      "See who's injured and who's scoring from penalties",
    ],
    icon: Clock,
    tone: {
      card: "hover:border-accent-gold/30",
      iconWrap: "bg-accent-gold/15",
      icon: "text-accent-gold",
      tag: "border-accent-gold/30 text-accent-gold",
      bullet: "bg-accent-gold",
      link: "text-accent-gold",
    },
  },
  {
    title: "Over/Under",
    href: "/value-analysis",
    tag: "Value Efficiency",
    description:
      "Find expensive players outscored by cheaper alternatives, and bargains doing better than players who cost more.",
    highlights: [
      "Compare goals + assists, or find high-value players barely getting minutes",
      "Include or exclude penalty goals and international stats",
      "Filter out injured players for a fairer comparison",
    ],
    icon: TrendingUp,
    tone: {
      card: "hover:border-emerald-500/40",
      iconWrap: "bg-emerald-500/15",
      icon: "text-emerald-400",
      tag: "border-emerald-500/40 text-emerald-400",
      bullet: "bg-emerald-400",
      link: "text-emerald-400",
    },
  },
  {
    title: "Injury Impact",
    href: "/injured",
    tag: "Availability Risk",
    description: "Track where injuries hurt most by player, club, and injury type.",
    highlights: [
      "Browse by player, by team, or by injury type",
      "See how much squad value each club has sidelined",
      "Expected return dates and time already missed",
    ],
    icon: HeartPulse,
    tone: {
      card: "hover:border-accent-cold-border",
      iconWrap: "bg-accent-cold-glow",
      icon: "text-accent-cold",
      tag: "border-accent-cold-border text-accent-cold",
      bullet: "bg-accent-cold",
      link: "text-accent-cold",
    },
  },
  {
    title: "Biggest Movers",
    href: "/biggest-movers",
    tag: "Trend Strength",
    description: "Track players whose market value keeps rising or falling across updates.",
    highlights: [
      "Players whose value has dropped or risen in multiple consecutive updates",
      "Separate tabs for biggest value drops and gains",
      "See exactly how much changed at each update date",
    ],
    icon: ArrowUpDown,
    tone: {
      card: "hover:border-violet-500/40",
      iconWrap: "bg-violet-500/15",
      icon: "text-violet-400",
      tag: "border-violet-500/40 text-violet-400",
      bullet: "bg-violet-400",
      link: "text-violet-400",
    },
  },
] as const;

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-2xl font-pixel text-text-primary sm:text-3xl">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm text-text-muted sm:text-base">{description}</p>
      </div>
      {action && (
        <Button
          asChild
          variant="outline"
          className="border-border-medium bg-card text-text-primary hover:bg-card-hover"
        >
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}

function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon;

  return (
    <Card
      className={`group h-full border-border-subtle bg-card transition-all duration-200 hover:-translate-y-0.5 hover:bg-card-hover ${feature.tone.card}`}
    >
      <CardHeader>
        <div className="mb-3 flex items-center justify-between">
          <span
            className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${feature.tone.iconWrap}`}
          >
            <Icon className={`h-5 w-5 ${feature.tone.icon}`} />
          </span>
          <Badge
            variant="outline"
            className={`border text-[10px] uppercase tracking-[0.16em] ${feature.tone.tag}`}
          >
            {feature.tag}
          </Badge>
        </div>
        <CardTitle className="text-xl text-text-primary">{feature.title}</CardTitle>
        <CardDescription className="text-sm leading-relaxed text-text-secondary">
          {feature.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {feature.highlights.map((highlight) => (
            <li key={highlight} className="flex items-start gap-2 text-sm text-text-secondary">
              <span
                className={`mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${feature.tone.bullet}`}
              />
              <span>{highlight}</span>
            </li>
          ))}
        </ul>
        <Link
          href={feature.href}
          className={`group/link mt-5 inline-flex items-center gap-2 text-sm font-semibold transition-colors hover:text-text-primary ${feature.tone.link}`}
        >
          Open {feature.title}
          <ArrowRight className="h-4 w-4 transition-transform group-hover/link:translate-x-0.5" />
        </Link>
      </CardContent>
    </Card>
  );
}

async function fetchHomeData(): Promise<{
  heroSnapshots: SnapshotItem[];
  snapshotGroups: SnapshotGroup[];
}> {
  const [
    analysisResult,
    teamFormResult,
    playersResult,
    injuredResult,
    losersResult,
    winnersResult,
  ] = await Promise.allSettled([
    getAnalysis(),
    getTeamFormData(),
    getMinutesValueData(),
    getInjuredPlayers(),
    findRepeatLosers(),
    findRepeatWinners(),
  ]);

  const analysisData = analysisResult.status === "fulfilled" ? analysisResult.value : null;
  if (analysisResult.status === "rejected")
    console.error("[Home] getAnalysis failed:", analysisResult.reason);
  const teamFormData = teamFormResult.status === "fulfilled" ? teamFormResult.value : null;
  if (teamFormResult.status === "rejected")
    console.error("[Home] getTeamFormData failed:", teamFormResult.reason);
  // Fold major-tournament national-team stats into season totals so every
  // homepage leaderboard (top scorers, npGA, bargains) counts World Cup/Euros/…
  // play, matching the /players and profile defaults.
  const players = (playersResult.status === "fulfilled" ? playersResult.value : []).map(
    includeTournamentStats,
  );
  if (playersResult.status === "rejected")
    console.error("[Home] getMinutesValueData failed:", playersResult.reason);
  const injuredPlayers = injuredResult.status === "fulfilled" ? injuredResult.value.players : [];
  if (injuredResult.status === "rejected")
    console.error("[Home] getInjuredPlayers failed:", injuredResult.reason);
  const biggestLosers = losersResult.status === "fulfilled" ? losersResult.value : null;
  if (losersResult.status === "rejected")
    console.error("[Home] findRepeatLosers failed:", losersResult.reason);
  const biggestWinners = winnersResult.status === "fulfilled" ? winnersResult.value : null;
  if (winnersResult.status === "rejected")
    console.error("[Home] findRepeatWinners failed:", winnersResult.reason);

  const aggregatedTop = analysisData?.aggregatedTop ?? [];
  const aggregatedBottom = analysisData?.aggregatedBottom ?? [];
  const topMaxCount = aggregatedTop[0]?.count ?? 0;
  const bestFormTeams = aggregatedTop.filter((t) => t.count === topMaxCount);
  const bottomMaxCount = aggregatedBottom[0]?.count ?? 0;
  const worstFormTeams = aggregatedBottom.filter((t) => t.count === bottomMaxCount);

  const { overperformers, underperformers } = splitPerformers(teamFormData?.allTeams ?? [], 20);

  const managerByClubId = new Map<string, ManagerInfo | null>();
  for (const team of [...overperformers, ...underperformers]) {
    if (!team.clubId) continue;
    managerByClubId.set(team.clubId, team.manager ?? null);
  }

  const aggregatedSnapshotTeams = [...aggregatedTop, ...aggregatedBottom];
  const missingManagerClubIds = [
    ...new Set(
      aggregatedSnapshotTeams
        .map((team) => team.clubId)
        .filter((clubId) => clubId && !managerByClubId.has(clubId)),
    ),
  ];
  if (missingManagerClubIds.length > 0) {
    const managerResults = await Promise.allSettled(
      missingManagerClubIds.map((clubId) => getManagerInfo(clubId)),
    );
    missingManagerClubIds.forEach((clubId, index) => {
      const result = managerResults[index];
      if (result?.status === "fulfilled") {
        managerByClubId.set(clubId, result.value);
      } else {
        console.error(`[Home] getManagerInfo failed for club ${clubId}:`, result?.reason);
        managerByClubId.set(clubId, null);
      }
    });
  }
  const getManagerForClub = (clubId?: string): ManagerInfo | undefined =>
    clubId ? (managerByClubId.get(clubId) ?? undefined) : undefined;

  const mostOverperformingTeams = pickWithTies(overperformers, (team) => team.deltaPts, "top", {
    sort: (a, b) => b.points - a.points || b.marketValueNum - a.marketValueNum,
  });
  const mostUnderperformingTeams = pickWithTies(
    underperformers,
    (team) => team.deltaPts,
    "bottom",
    { sort: (a, b) => a.points - b.points || a.marketValueNum - b.marketValueNum },
  );
  const mostOverperformingTeam = mostOverperformingTeams[0] ?? null;
  const mostUnderperformingTeam = mostUnderperformingTeams[0] ?? null;

  const statsNoPen = applyStatsToggles(players.map(toPlayerStats), { includePen: false });
  const underperformerCandidates = findValueCandidates(statsNoPen, {
    candidateOutperforms: false,
    minMinutes: MIN_VALUE_ANALYSIS_MINUTES,
    sortAsc: false,
  });
  const overperformerCandidates = findValueCandidates(statsNoPen, {
    candidateOutperforms: true,
    sortAsc: true,
  });

  const mostOverpricedPlayers = pickWithTies(
    underperformerCandidates,
    (player) => player.count,
    "top",
    { sort: (a, b) => b.marketValue - a.marketValue },
  );
  const mostBargainPlayers = pickWithTies(
    overperformerCandidates,
    (player) => player.count,
    "top",
    { sort: (a, b) => b.points - a.points || a.marketValue - b.marketValue },
  );
  const mostOverpricedPlayer = mostOverpricedPlayers[0] ?? null;

  const playersByNpga = sortByNpgaDesc(players);
  const byFewerMins = (a: MinutesValuePlayer, b: MinutesValuePlayer) => a.minutes - b.minutes;
  const mostNpgaPlayers = pickWithTies(playersByNpga, (player) => getNpga(player), "top", {
    sort: byFewerMins,
    max: 1,
  });
  const mostNpgaPlayer = mostNpgaPlayers[0] ?? null;
  const mostNpgaSignings = pickWithTies(
    players.filter((p) => p.isNewSigning),
    (player) => getNpga(player),
    "top",
    { sort: byFewerMins, max: 1 },
  );
  const mostValuableLoans = pickWithTies(
    players.filter((p) => p.isOnLoan),
    (player) => player.marketValue,
    "top",
    { sort: (a, b) => getNpga(b) - getNpga(a) || a.minutes - b.minutes, max: 1 },
  );

  const zeroCapsPlayers = players.filter((p) => (p.intlCareerCaps ?? 0) === 0);
  const mostValuableZeroCapsPlayers = pickWithTies(
    zeroCapsPlayers,
    (player) => player.marketValue,
    "top",
    { sort: (a, b) => getNpga(b) - getNpga(a) || a.minutes - b.minutes, max: 1 },
  );
  const mostNpgaZeroCapsPlayers = pickWithTies(
    sortByNpgaDesc(zeroCapsPlayers),
    (player) => getNpga(player),
    "top",
    { sort: byFewerMins, max: 1 },
  );

  const topScorerLast5 =
    players.length > 0
      ? players.reduce((best, p) => {
          const s = getFormNpga(p, 5);
          const bestS = getFormNpga(best, 5);
          if (s > bestS) return p;
          if (s === bestS && getFormMinutes(p, 5) < getFormMinutes(best, 5)) return p;
          return best;
        })
      : null;
  const topScorerLast10 =
    players.length > 0
      ? players.reduce((best, p) => {
          const s = getFormNpga(p, 10);
          const bestS = getFormNpga(best, 10);
          if (s > bestS) return p;
          if (s === bestS && getFormMinutes(p, 10) < getFormMinutes(best, 10)) return p;
          return best;
        })
      : null;

  const mostValuableInjuredPlayers = pickWithTies(
    injuredPlayers,
    (player) => player.marketValueNum,
    "top",
    { sort: (a, b) => a.name.localeCompare(b.name) },
  );

  const injuryTeamMap = new Map<string, InjuryTeamSummary>();
  for (const player of injuredPlayers) {
    const key = `${player.league}::${player.club}`;
    const existing = injuryTeamMap.get(key);
    if (existing) {
      existing.totalValue += player.marketValueNum;
      existing.count += 1;
      continue;
    }
    injuryTeamMap.set(key, {
      club: player.club,
      league: player.league,
      clubLogoUrl: player.clubLogoUrl,
      totalValue: player.marketValueNum,
      count: 1,
    });
  }
  const injuryTeams = [...injuryTeamMap.values()];
  const mostAffectedInjuryTeams = pickWithTies(injuryTeams, (team) => team.totalValue, "top", {
    sort: (a, b) => b.count - a.count || a.club.localeCompare(b.club),
  });

  // --- Section snapshot items (ties always shown; Player Explorer capped by category count) ---

  const recentFormItems: SnapshotItem[] = [
    ...bestFormTeams.map((team) =>
      teamItem(team, "Best form", "/form", aggregatedDetail(team), {
        manager: getManagerForClub(team.clubId),
        tone: "green",
      }),
    ),
    ...worstFormTeams.map((team) =>
      teamItem(team, "Worst form", "/form", aggregatedDetail(team), {
        manager: getManagerForClub(team.clubId),
        tone: "red",
      }),
    ),
  ];

  // --- Hero snapshots (top-right card) ---
  const heroSnapshots = [
    ...recentFormItems,
    mostOverperformingTeam &&
      teamItem(
        mostOverperformingTeam,
        "Biggest overperformer",
        "/expected-position",
        `${mostOverperformingTeam.league} · ${formatSigned(mostOverperformingTeam.deltaPts)} points above squad value expectation`,
        { manager: getManagerForClub(mostOverperformingTeam.clubId), tone: "green" },
      ),
    mostUnderperformingTeam &&
      teamItem(
        mostUnderperformingTeam,
        "Biggest underperformer",
        "/expected-position",
        `${mostUnderperformingTeam.league} · ${formatSigned(mostUnderperformingTeam.deltaPts)} points below squad value expectation`,
        { manager: getManagerForClub(mostUnderperformingTeam.clubId), tone: "red" },
      ),
    mostOverpricedPlayer &&
      playerItem(
        mostOverpricedPlayer,
        "Most overpriced player",
        "/value-analysis?mode=ga",
        `${mostOverpricedPlayer.marketValueDisplay} · outscored by ${mostOverpricedPlayer.count} players who cost less`,
        { tone: "red" },
      ),
    mostNpgaPlayer &&
      playerItem(
        mostNpgaPlayer,
        "Top scorer (npG+A)",
        "/players?sort=ga",
        `${mostNpgaPlayer.club} · ${getNpga(mostNpgaPlayer)} G+A (excl. pens)`,
        { tone: "green" },
      ),
  ].filter(Boolean) as SnapshotItem[];

  const teamFormItems: SnapshotItem[] = [
    ...mostOverperformingTeams.map((team) =>
      teamItem(
        team,
        "Biggest overperformer",
        "/expected-position",
        `${team.league} · ${formatSigned(team.deltaPts)} points gap (above expectation)`,
        { manager: getManagerForClub(team.clubId), tone: "green" },
      ),
    ),
    ...mostUnderperformingTeams.map((team) =>
      teamItem(
        team,
        "Biggest underperformer",
        "/expected-position",
        `${team.league} · ${formatSigned(team.deltaPts)} points gap (below expectation)`,
        { manager: getManagerForClub(team.clubId), tone: "red" },
      ),
    ),
  ];

  const fitButBenched =
    players.filter((p) => missedPct(p) < 0.5).sort((a, b) => a.minutes - b.minutes)[0] ?? null;

  const valueAnalysisItems: SnapshotItem[] = [
    ...mostOverpricedPlayers.map((p) =>
      playerItem(
        p,
        "Most overpriced",
        "/value-analysis?mode=ga",
        `${p.club} · ${p.marketValueDisplay}`,
        {
          metrics: [
            `${p.points} npG+A`,
            `${formatMinutes(p.minutes)} mins`,
            `outscored by ${p.count} cheaper players`,
          ],
          tone: "red",
        },
      ),
    ),
    ...mostBargainPlayers.map((p) =>
      playerItem(
        p,
        "Best bargain",
        "/value-analysis?mode=ga&dTab=bargains",
        `${p.club} · ${p.marketValueDisplay}`,
        {
          metrics: [
            `${p.points} npG+A`,
            `${formatMinutes(p.minutes)} mins`,
            `outscores ${p.count} pricier players`,
          ],
          tone: "green",
        },
      ),
    ),
    ...(fitButBenched
      ? [
          playerItem(
            fitButBenched,
            "Available but barely playing",
            "/value-analysis?mode=mins&maxMiss=50",
            `${fitButBenched.club} · ${fitButBenched.marketValueDisplay}`,
            {
              metrics: [
                `${formatMinutes(fitButBenched.minutes)} mins`,
                `${displayMatches(fitButBenched)} games`,
                `available for 50%+ of games`,
              ],
              tone: "red",
            },
          ),
        ]
      : []),
  ];

  const formScorerItems: SnapshotItem[][] = [];
  if (topScorerLast5 && topScorerLast10) {
    const p5 = topScorerLast5,
      p10 = topScorerLast10;
    if (p5.playerId === p10.playerId) {
      formScorerItems.push([
        playerItem(
          p5,
          "Top scorer (last 5 & 10)",
          "/players?sort=ga&fw=5",
          `${p5.club} · ${getFormNpga(p5, 5)} npG+A (5) · ${getFormNpga(p5, 10)} npG+A (10)`,
          { metrics: [`Season ${getNpga(p5)} npG+A`, p5.marketValueDisplay], tone: "green" },
        ),
      ]);
    } else {
      formScorerItems.push([
        playerItem(
          p10,
          "Top scorer (last 10)",
          "/players?sort=ga&fw=10",
          `${p10.club} · ${getFormNpga(p10, 10)} G+A (excl. pens) in last 10`,
          { metrics: [`Season ${getNpga(p10)} npG+A`, p10.marketValueDisplay], tone: "green" },
        ),
      ]);
      formScorerItems.push([
        playerItem(
          p5,
          "Top scorer (last 5)",
          "/players?sort=ga&fw=5",
          `${p5.club} · ${getFormNpga(p5, 5)} G+A (excl. pens) in last 5`,
          { metrics: [`Season ${getNpga(p5)} npG+A`, p5.marketValueDisplay], tone: "green" },
        ),
      ]);
    }
  }

  const playerItems = [
    mostNpgaPlayers.map((p) =>
      playerItem(
        p,
        "Top scorer (npG+A)",
        "/players?sort=ga",
        `${p.club} · ${getNpga(p)} G+A (excl. pens)`,
        { metrics: [`${formatMinutes(p.minutes)} mins`, p.marketValueDisplay] },
      ),
    ),
    ...formScorerItems,
    mostNpgaSignings.map((p) =>
      playerItem(
        p,
        "Top scoring signing",
        "/players?signing=transfer&sort=ga",
        `${p.club} · ${getNpga(p)} G+A (excl. pens)`,
        { metrics: [`${formatMinutes(p.minutes)} mins`, p.marketValueDisplay] },
      ),
    ),
    mostValuableLoans.map((p) =>
      playerItem(
        p,
        "Most valuable loan",
        "/players?signing=loan&sort=value",
        `${p.club} · ${p.marketValueDisplay}`,
        { metrics: [`npG+A ${getNpga(p)}`, `${formatMinutes(p.minutes)} mins`] },
      ),
    ),
    mostValuableZeroCapsPlayers.map((p) =>
      playerItem(
        p,
        "Most valuable uncapped",
        "/players?sort=value&maxcaps=0",
        `${p.club}${p.nationality ? ` · ${p.nationality}` : ""} · ${p.marketValueDisplay}`,
        { metrics: [`npG+A ${getNpga(p)}`, `${formatMinutes(p.minutes)} mins`] },
      ),
    ),
    mostNpgaZeroCapsPlayers.map((p) =>
      playerItem(
        p,
        "Top scoring uncapped",
        "/players?sort=ga&maxcaps=0",
        `${p.club}${p.nationality ? ` · ${p.nationality}` : ""} · ${getNpga(p)} G+A (excl. pens)`,
        { metrics: [`${formatMinutes(p.minutes)} mins`, p.marketValueDisplay] },
      ),
    ),
  ]
    .filter((a) => a.length)
    .flat();

  const injuryItems: SnapshotItem[] = [
    ...mostValuableInjuredPlayers.map((p) =>
      playerItem(
        p,
        "Most valuable injured",
        "/injured?tab=players",
        `${p.club} · ${p.marketValue}`,
        { metrics: [p.injury] },
      ),
    ),
    ...mostAffectedInjuryTeams.map((team): SnapshotItem => {
      const cid = extractClubIdFromLogoUrl(team.clubLogoUrl);
      return {
        label: "Hardest hit club",
        value: team.club,
        detail: `${team.league} · ${formatMarketValue(team.totalValue)} lost · ${team.count} injured`,
        href: cid ? getTeamDetailHref(cid) : "/injured?tab=teams",
        imageUrl: team.clubLogoUrl,
        imageContain: true,
      };
    }),
  ];

  const biggestMoversItems: SnapshotItem[] = [];
  function addTopMover(
    movers: MarketValueMover[][] | undefined,
    label: string,
    tab: string,
    tone: SnapshotTone,
  ): void {
    if (!movers || movers.length === 0) return;
    const topTotal = movers[0].reduce((s, m) => s + m.absoluteChange, 0);
    for (const appearances of movers) {
      if (appearances.reduce((s, m) => s + m.absoluteChange, 0) < topTotal) break;
      const latest = [...appearances].sort((a, b) => b.period.localeCompare(a.period))[0];
      const earliest = [...appearances].sort((a, b) => a.period.localeCompare(b.period))[0];
      const sign = tone === "red" ? "-" : "+";
      biggestMoversItems.push({
        label,
        value: latest.name,
        detail: `${latest.club} · ${sign}${formatMarketValue(earliest.absoluteChange)} in last ${Math.ceil((Date.now() - new Date(earliest.period).getTime()) / (365.25 * 86400000))}y`,
        href: `/biggest-movers?tab=${tab}`,
        imageUrl: latest.imageUrl,
        secondaryImageUrl: latest.clubLogoUrl,
        playerId: latest.playerId,
        profileUrl: latest.profileUrl,
        tone,
      });
    }
  }
  addTopMover(biggestLosers?.repeatMovers, "In freefall", "losers", "red");
  addTopMover(biggestWinners?.repeatMovers, "On the rise", "winners", "green");

  const snapshotGroups = [
    recentFormItems.length && {
      title: "Recent Form",
      description: "Teams leading the most categories across their last 5–20 matches.",
      href: "/form",
      items: recentFormItems,
    },
    teamFormItems.length && {
      title: "Value vs Table",
      description: "Teams doing better or worse than their squad spending predicts.",
      href: "/expected-position",
      items: teamFormItems,
    },
    valueAnalysisItems.length && {
      title: "Over/Under",
      description:
        "Expensive players outscored by cheaper alternatives, and bargains outproducing pricier peers.",
      href: "/value-analysis",
      items: valueAnalysisItems,
    },
    playerItems.length && {
      title: "Player Explorer",
      description: "Output leaders, signings, loans, and uncapped talents.",
      href: "/players",
      items: playerItems,
    },
    biggestMoversItems.length && {
      title: "Biggest Movers",
      description: "Players on sustained value rises or drops.",
      href: "/biggest-movers",
      items: biggestMoversItems,
    },
    injuryItems.length && {
      title: "Injury Impact",
      description: "Highest-value absences and hardest-hit clubs.",
      href: "/injured",
      items: injuryItems,
    },
  ].filter(Boolean) as SnapshotGroup[];

  return { heroSnapshots, snapshotGroups };
}

type HomeData = Awaited<ReturnType<typeof fetchHomeData>>;

async function HeroCard({ dataPromise }: { dataPromise: Promise<HomeData> }) {
  const { heroSnapshots } = await dataPromise;
  return (
    <Card className="border-border-medium bg-black/85 backdrop-blur-sm transition-colors duration-200 hover:border-accent-blue/30">
      <CardHeader className="!pb-0">
        <Badge
          variant="outline"
          className="w-fit border-accent-blue/40 bg-accent-blue/10 text-accent-blue"
        >
          Live snapshots
        </Badge>
        <CardTitle className="text-xl text-text-primary">Latest Highlights</CardTitle>
        <CardDescription className="text-sm text-text-secondary">
          Key names across form, value, output, and injuries.
        </CardDescription>
      </CardHeader>
      <CardContent className="!pt-0">
        <p className="text-xs uppercase tracking-[0.16em] text-text-muted">Latest Feed</p>
        <div className="mt-3 space-y-2">
          {heroSnapshots.length > 0 ? (
            heroSnapshots.map((item) => (
              <SnapshotItemRow key={`${item.label}-${item.value}`} item={item} variant="hero" />
            ))
          ) : (
            <div className="rounded-lg border border-border-subtle bg-card px-3 py-2 text-sm text-text-muted">
              Snapshot data is temporarily unavailable. Open a section below for full tables.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

async function StandoutsGrid({ dataPromise }: { dataPromise: Promise<HomeData> }) {
  const { snapshotGroups } = await dataPromise;
  if (snapshotGroups.length === 0) {
    return (
      <div className="rounded-xl border border-border-subtle bg-card p-4 text-sm text-text-muted">
        Snapshot data is temporarily unavailable. Open a section for full live tables.
      </div>
    );
  }
  return (
    <div className="columns-1 gap-4 lg:columns-2">
      {snapshotGroups.map((group) => (
        <Card
          key={group.title}
          className="mb-4 break-inside-avoid border-border-subtle bg-card transition-colors duration-200 hover:border-border-medium"
        >
          <CardHeader className="pb-0 sm:pb-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg text-text-primary">{group.title}</CardTitle>
                <CardDescription className="mt-1 text-sm text-text-secondary">
                  {group.description}
                </CardDescription>
              </div>
              <Link
                href={group.href}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-accent-blue transition-colors hover:text-text-primary"
              >
                Open
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {group.items.map((item) => (
              <SnapshotItemRow
                key={`${group.title}-${item.label}-${item.value}`}
                item={item}
                variant="section"
              />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Home() {
  const dataPromise = fetchHomeData();

  return (
    <div className="pb-16 sm:pb-20">
      <section className="full-bleed relative overflow-hidden border-b border-border-subtle bg-[radial-gradient(circle_at_14%_10%,rgba(0,255,135,0.16),transparent_40%),radial-gradient(circle_at_82%_8%,rgba(88,166,255,0.15),transparent_40%),linear-gradient(180deg,var(--bg-base),var(--bg-elevated))]">
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(88,166,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(88,166,255,0.04)_1px,transparent_1px)] bg-[size:72px_72px]"
          aria-hidden="true"
        />

        <div className="page-container relative py-12 sm:py-16 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div>
              <Badge className="mb-5 border-accent-hot-border bg-accent-hot-glow px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-accent-hot">
                Football Analytics Across Europe&apos;s Top 5 Leagues
              </Badge>

              <h1 className="max-w-4xl text-4xl font-pixel leading-tight tracking-tight text-text-primary sm:text-5xl lg:text-6xl">
                See what the table misses:
                <span className="ml-2 bg-gradient-to-r from-accent-hot via-accent-blue to-accent-gold bg-clip-text text-transparent">
                  form, value, and injuries.
                </span>
              </h1>

              <p className="mt-5 max-w-2xl text-sm text-text-secondary sm:text-lg">
                SquadStat surfaces the biggest swings fast: hot and cold teams, overpriced players,
                undervalued performers, and injury cost.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link href="/form">Analyze Recent Form</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-border-medium bg-card text-text-primary hover:bg-card-hover"
                >
                  <Link href="/value-analysis">
                    Scan Value Gaps
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <Suspense fallback={<HeroCardSkeleton />}>
              <HeroCard dataPromise={dataPromise} />
            </Suspense>
          </div>
        </div>
      </section>

      <section className="pt-12 sm:pt-16">
        <SectionHeading
          eyebrow="Live data"
          title="Latest Standouts"
          description="The best and worst from each section — open the full view for more."
        />

        <Suspense fallback={<StandoutsGridSkeleton />}>
          <StandoutsGrid dataPromise={dataPromise} />
        </Suspense>
      </section>

      <section className="pt-12 sm:pt-16">
        <SectionHeading
          eyebrow="Explore"
          title="Explore"
          description="Six sections covering form, squad value, player stats, injuries, and market trends."
          action={{ href: "/value-analysis", label: "Open Over/Under" }}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard key={feature.href} feature={feature} />
          ))}
        </div>
      </section>

      <section className="pt-12 sm:pt-16">
        <div className="rounded-2xl border border-border-medium bg-card p-5 sm:p-6">
          <h2 className="text-xl font-pixel text-text-primary sm:text-2xl">Open a section</h2>
          <p className="mt-1 text-sm text-text-muted">
            Start from the question you want to answer.{" "}
            <Link
              href="/how-it-works"
              className="text-accent-blue hover:text-text-primary transition-colors"
            >
              How do we calculate these stats?
            </Link>
          </p>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Link
                key={f.href}
                href={f.href}
                className="group flex items-center justify-between rounded-lg border border-border-subtle bg-elevated px-3 py-2 text-sm font-medium text-text-secondary transition-all duration-200 hover:-translate-y-px hover:border-border-medium hover:bg-card-hover hover:text-text-primary"
              >
                <span>{f.title}</span>
                <ArrowRight className="h-3.5 w-3.5 text-text-muted transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
