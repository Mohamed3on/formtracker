import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Crown, Medal, TrendingDown, TrendingUp } from "lucide-react";
import { DetailHero, DetailPageShell } from "@/components/DetailHero";
import { createPageMetadata } from "@/lib/metadata";
import { getLeistungsdatenUrl, getPlayerDetailHref } from "@/lib/format";
import { getPlayerDetailData, seasonNpga, type PlayerRankings } from "@/lib/player-detail";
import { paramsToScope } from "@/lib/comparison-scope";
import { enrichRecentMatches } from "@/lib/player-recent-matches";
import { displayAvailable } from "@/lib/filter-players";
import { MIN_COMPARISON_COUNT } from "@/lib/value-analysis";
import { InfoTip } from "@/app/components/InfoTip";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { LeagueBadge } from "@/components/LeagueBadge";
import { PlayerSubtitle } from "@/components/PlayerSubtitle";
import { timeAgo } from "@/app/components/DataLastUpdated";
import { ComparisonPanels } from "./ComparisonPanels";
import { HeroSignalBadges } from "./HeroSignalBadges";
import { MinutesBenchmarkSection } from "./MinutesBenchmarkSection";
import { DetailDeck } from "@/components/DetailDeck";
import { HeroMetric } from "@/components/HeroMetric";
import { SectionPanel } from "@/components/SectionPanel";
import { SignalBadge } from "@/components/SignalBadge";
import { TeamLogo } from "@/components/TeamLogo";
import type { MinutesValuePlayer, RecentGameStats } from "@/app/types";
import { POSITION_NAMES } from "@/lib/player-aggregation";
import { PlayerInjuryBadge } from "./PlayerInjuryBadge";
import { PlayerTransferBadges } from "./PlayerTransferBadges";
import { effectivePosition, getBroadPositionFilter } from "@/lib/positions";
import { JsonLd } from "@/components/JsonLd";
import { absoluteUrl } from "@/lib/site-config";

function rankColor(rank: number, total: number): string {
  const pct = rank / total;
  if (rank <= 3) return "text-amber-400";
  if (pct <= 0.05) return "text-emerald-400";
  if (pct <= 0.15) return "text-sky-400";
  if (pct <= 0.4) return "text-text-primary";
  return "text-text-secondary";
}

function RankBadge({
  rank,
  total,
  className,
}: {
  rank: number;
  total: number;
  className?: string;
}) {
  return (
    <span className={`font-value ${rankColor(rank, total)} ${className ?? ""}`}>
      {rank === 1 && <Crown className="mr-0.5 inline h-3 w-3" />}
      {rank > 1 && rank <= 3 && <Medal className="mr-0.5 inline h-3 w-3" />}#{rank}
    </span>
  );
}

function GoalBreakdown({ goals, penaltyGoals }: { goals: number; penaltyGoals: number }) {
  const openPlay = goals - penaltyGoals;
  if (goals === 0) return <span className="text-text-muted">0</span>;
  return (
    <>
      {openPlay > 0 && <span className="text-emerald-400">{openPlay}</span>}
      {penaltyGoals > 0 && (
        <span className="text-amber-400">
          {openPlay > 0 ? "+" : ""}
          {penaltyGoals}P
        </span>
      )}
    </>
  );
}

function RankCell({ rank, total, href }: { rank: number; total: number; href?: string }) {
  return (
    <TableCell className="text-right whitespace-nowrap">
      {href ? (
        <Link href={href} className="transition-opacity hover:opacity-70">
          <RankBadge rank={rank} total={total} />
        </Link>
      ) : (
        <RankBadge rank={rank} total={total} />
      )}
    </TableCell>
  );
}

const RANKING_METRICS: Array<{
  overallKey: keyof PlayerRankings;
  leagueKey: keyof PlayerRankings;
  clubKey: keyof PlayerRankings;
  positionKey: keyof PlayerRankings;
  label: string;
  shortLabel: string;
  sortKey: string | null;
}> = [
  {
    overallKey: "marketValueOverall",
    leagueKey: "marketValueLeague",
    clubKey: "marketValueClub",
    positionKey: "marketValuePosition",
    label: "Market value",
    shortLabel: "Value",
    sortKey: "value",
  },
  {
    overallKey: "npgaOverall",
    leagueKey: "npgaLeague",
    clubKey: "npgaClub",
    positionKey: "npgaPosition",
    label: "npG+A",
    shortLabel: "npG+A",
    sortKey: "ga",
  },
  {
    overallKey: "pointsOverall",
    leagueKey: "pointsLeague",
    clubKey: "pointsClub",
    positionKey: "pointsPosition",
    label: "G+A",
    shortLabel: "G+A",
    sortKey: "ga",
  },
  {
    overallKey: "minutesOverall",
    leagueKey: "minutesLeague",
    clubKey: "minutesClub",
    positionKey: "minutesPosition",
    label: "Minutes",
    shortLabel: "Mins",
    sortKey: "mins",
  },
  {
    overallKey: "goalsOverall",
    leagueKey: "goalsLeague",
    clubKey: "goalsClub",
    positionKey: "goalsPosition",
    label: "Goals",
    shortLabel: "Goals",
    sortKey: "ga",
  },
  {
    overallKey: "assistsOverall",
    leagueKey: "assistsLeague",
    clubKey: "assistsClub",
    positionKey: "assistsPosition",
    label: "Assists",
    shortLabel: "Asst",
    sortKey: "ga",
  },
  {
    overallKey: "form5Overall",
    leagueKey: "form5League",
    clubKey: "form5Club",
    positionKey: "form5Position",
    label: "Last 5 npG+A",
    shortLabel: "L5",
    sortKey: "ga&fw=5",
  },
  {
    overallKey: "form10Overall",
    leagueKey: "form10League",
    clubKey: "form10Club",
    positionKey: "form10Position",
    label: "Last 10 npG+A",
    shortLabel: "L10",
    sortKey: "ga&fw=10",
  },
];

function formatShortDate(value: string): string {
  if (!value) return "Unknown";
  const date = new Date(`${value}T12:00:00Z`);
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function RecentMatchCard({ match }: { match: RecentGameStats }) {
  const hasScore = match.teamGoals !== undefined && match.opponentGoals !== undefined;
  const resultLabel = hasScore
    ? match.teamGoals! > match.opponentGoals!
      ? "W"
      : match.teamGoals! < match.opponentGoals!
        ? "L"
        : "D"
    : null;
  const resultTone =
    resultLabel === "W"
      ? "border-accent-hot-border bg-accent-hot-glow text-accent-hot"
      : resultLabel === "L"
        ? "border-accent-cold-border bg-accent-cold-glow text-accent-cold-soft"
        : "border-border-subtle bg-card text-text-secondary";
  const venuePrefix = match.venue === "away" ? "at " : "vs ";
  const opponentHref = match.opponentClubId ? `/teams/${match.opponentClubId}` : null;
  const contextLabel = [
    match.competitionName || match.competitionId,
    match.gameDay ? `MD ${match.gameDay}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const venueLabel = match.venue === "away" ? "Away" : match.venue === "home" ? "Home" : null;
  const positionLabel = match.positionId ? POSITION_NAMES[match.positionId] : null;

  return (
    <div className="hover-lift flex flex-col justify-between rounded-2xl border border-border-subtle bg-[linear-gradient(180deg,rgba(22,27,34,0.98),rgba(13,17,23,0.96))] p-3.5">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted">
              {formatShortDate(match.date)}
            </p>
            {contextLabel && (
              <p className="mt-0.5 text-[11px] text-text-secondary">{contextLabel}</p>
            )}
          </div>
          {hasScore && (
            <div
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-value ${resultTone}`}
            >
              <span>{resultLabel}</span>
              <span>
                {match.teamGoals}:{match.opponentGoals}
              </span>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2.5">
          <TeamLogo src={match.opponentLogoUrl} alt={match.opponentName} />
          <div className="min-w-0">
            <p className="truncate text-sm text-text-primary">
              {match.opponentName ? (
                <>
                  {venuePrefix}
                  {opponentHref ? (
                    <Link href={opponentHref} className="hover:underline">
                      {match.opponentName}
                    </Link>
                  ) : (
                    match.opponentName
                  )}
                </>
              ) : (
                "Opponent unavailable"
              )}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-text-secondary">
              {venueLabel && (
                <span className={match.venue === "home" ? "text-amber-400" : "text-sky-400"}>
                  {venueLabel}
                </span>
              )}
              {venueLabel && <span className="opacity-40">·</span>}
              <span
                className={`font-value ${match.minutes >= 70 ? "text-emerald-400" : match.minutes >= 45 ? "text-text-primary" : "text-text-secondary"}`}
              >
                {match.minutes}&apos;
              </span>
              {positionLabel && (
                <>
                  <span className="opacity-40">·</span>
                  <span>{positionLabel}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-lg border border-border-subtle/80 bg-black/20 px-2 py-1.5 text-center">
            <p className="text-[9px] uppercase tracking-[0.16em] text-text-muted">Goals</p>
            <p className="mt-0.5 font-value text-base">
              <GoalBreakdown goals={match.goals} penaltyGoals={match.penaltyGoals ?? 0} />
            </p>
          </div>
          <div className="rounded-lg border border-border-subtle/80 bg-black/20 px-2 py-1.5 text-center">
            <p className="text-[9px] uppercase tracking-[0.16em] text-text-muted">Assists</p>
            <p
              className={`mt-0.5 font-value text-base ${match.assists > 0 ? "text-emerald-400" : "text-text-muted"}`}
            >
              {match.assists}
            </p>
          </div>
        </div>

        {match.matchReportUrl && (
          <a
            href={match.matchReportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-text-secondary transition-colors hover:text-text-primary"
          >
            Match report
            <ArrowUpRight className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function RecentMatches({ matches }: { matches: RecentGameStats[] }) {
  const recentMatches = enrichRecentMatches(matches);

  if (recentMatches.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border-subtle bg-black/20 px-4 py-6 text-sm text-text-secondary">
        No recent match log is stored for this player.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {recentMatches.map((match) => (
        <RecentMatchCard
          key={match.gameId || `${match.date}-${match.minutes}-${match.goals}-${match.assists}`}
          match={match}
        />
      ))}
    </div>
  );
}

function ClubContextItem({
  player,
  highlighted,
  rank,
}: {
  player: MinutesValuePlayer;
  highlighted: boolean;
  rank: number;
}) {
  const npga = seasonNpga(player);

  return (
    <Link
      href={getPlayerDetailHref(player.playerId)}
      className={`hover-lift flex h-full flex-col justify-between gap-3 rounded-2xl border p-4 transition-colors ${
        highlighted
          ? "border-accent-blue/25 bg-[linear-gradient(180deg,rgba(88,166,255,0.12),rgba(13,17,23,0.95))]"
          : "border-border-subtle bg-[linear-gradient(180deg,rgba(22,27,34,0.92),rgba(13,17,23,0.95))] hover:border-border-medium hover:bg-card-hover"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-value ${
            highlighted ? "bg-accent-blue/20 text-accent-blue" : "bg-black/20 text-text-muted"
          }`}
        >
          {rank}
        </div>
        <PlayerAvatar
          imageUrl={player.imageUrl}
          name={player.name}
          size="sm"
          className="border border-border-subtle"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-text-primary">{player.name}</p>
          <p className="mt-0.5 truncate text-[11px] font-value text-text-secondary">
            {player.marketValueDisplay}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div
          className={`rounded-xl border px-2.5 py-2 ${
            highlighted
              ? "border-accent-blue/20 bg-accent-blue/10"
              : "border-border-subtle/80 bg-black/20"
          }`}
        >
          <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted">npG+A</p>
          <p className="mt-0.5 text-lg font-value text-accent-hot">{npga}</p>
        </div>
        <div className="rounded-xl border border-border-subtle/80 bg-black/20 px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Minutes</p>
          <p className="mt-0.5 text-lg font-value text-text-primary">
            {player.minutes.toLocaleString()}
          </p>
        </div>
      </div>
    </Link>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ playerId: string }>;
}): Promise<Metadata> {
  const { playerId } = await params;
  const data = await getPlayerDetailData(playerId);

  if (!data) {
    return createPageMetadata({
      title: "Player Report",
      description: "Detailed player report with rankings, form, and value comparisons.",
      path: `/players/${playerId}`,
      noIndex: true,
    });
  }

  const { player } = data;
  return createPageMetadata({
    title: `${player.name} Stats, Form & Market Value`,
    description: `${player.name} (${player.club}, ${player.league}): ${player.goals} goals, ${player.assists} assists, ${player.minutes.toLocaleString("en")} minutes and a ${player.marketValueDisplay} market value, with form and peer rankings.`,
    path: `/players/${player.playerId}`,
    keywords: [
      player.name,
      `${player.name} stats`,
      `${player.name} market value`,
      player.club,
      player.league,
      "player report",
      "football player rankings",
      "player form stats",
    ],
  });
}

export default async function PlayerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ playerId: string }>;
  searchParams: Promise<{ sameLeague?: string; allLeagues?: string; top5?: string }>;
}) {
  const { playerId } = await params;
  const scope = paramsToScope(await searchParams);
  const data = await getPlayerDetailData(playerId);

  if (!data) {
    if (/^\d+$/.test(playerId)) {
      const url = `https://www.transfermarkt.com/x/profil/spieler/${playerId}`;
      return (
        <div className="mx-auto flex min-h-64 max-w-md flex-col items-center justify-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border-subtle bg-elevated">
            <ArrowUpRight className="h-5 w-5 text-text-muted" />
          </div>
          <div>
            <p className="text-lg font-pixel text-text-primary">Not in tracked dataset</p>
            <p className="mt-1 text-sm text-text-secondary">Redirecting to Transfermarkt&hellip;</p>
          </div>
          <meta httpEquiv="refresh" content={`1;url=${url}`} />
          <a
            href={url}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-elevated px-4 py-2 text-sm text-text-primary transition-colors hover:bg-card-hover"
          >
            Go now
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
          <Link
            href="/players"
            className="text-xs text-text-muted transition-colors hover:text-text-secondary"
          >
            ← Back to player explorer
          </Link>
        </div>
      );
    }
    notFound();
  }

  const {
    player,
    rankings,
    trend,
    form,
    comparisons,
    clubmates,
    topClubmatesByNpga,
    minutesBenchmark,
    subgroupRankings,
    positionLabel,
    positionShortLabel,
    positionPeerCount,
    overallCount,
    leagueCount,
    clubCount,
    penaltyRank,
  } = data;
  const { signalSummary } = comparisons.all;
  const fallbackMatchCount = player.recentForm?.length ?? 0;
  const peersPlayingLess = minutesBenchmark.pricier.playingLessCount;
  const peersPlayingMore = minutesBenchmark.cheaper.playingMoreCount;
  const pageUrl = absoluteUrl(`/players/${player.playerId}`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": pageUrl,
        url: pageUrl,
        name: `${player.name} stats, form and market value`,
        description: `${player.name} performance report for ${player.club} in ${player.league}.`,
        mainEntity: { "@id": `${pageUrl}#player` },
      },
      {
        "@type": "Person",
        "@id": `${pageUrl}#player`,
        name: player.name,
        url: pageUrl,
        ...(player.imageUrl ? { image: player.imageUrl } : {}),
        jobTitle: "Professional footballer",
        nationality: player.nationality,
        sameAs: getLeistungsdatenUrl(player.profileUrl),
        memberOf: {
          "@type": "SportsTeam",
          name: player.club,
          ...(data.clubId ? { url: absoluteUrl(`/teams/${data.clubId}`) } : {}),
        },
        additionalProperty: [
          {
            "@type": "PropertyValue",
            name: "Market value",
            value: player.marketValueDisplay,
          },
          { "@type": "PropertyValue", name: "Goals", value: player.goals },
          { "@type": "PropertyValue", name: "Assists", value: player.assists },
          { "@type": "PropertyValue", name: "Minutes played", value: player.minutes },
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Players",
            item: absoluteUrl("/players"),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: player.name,
            item: pageUrl,
          },
        ],
      },
    ],
  };

  return (
    <DetailPageShell backHref="/players" backLabel="Back to player explorer">
      <JsonLd data={jsonLd} />
      <DetailHero>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <PlayerAvatar
            imageUrl={player.imageUrl}
            name={player.name}
            size="lg"
            className="h-24 w-24 rounded-[1.5rem] border border-border-medium sm:h-28 sm:w-28"
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <LeagueBadge league={player.league} />
              {player.isOnLoan && (
                <SignalBadge className="border-accent-gold/25 bg-accent-gold/10 text-accent-gold">
                  On loan
                </SignalBadge>
              )}
              {!player.isOnLoan && player.isNewSigning && (
                <SignalBadge className="border-accent-blue/25 bg-accent-blue/10 text-accent-blue">
                  New signing
                </SignalBadge>
              )}
              {player.isCurrentIntl && (
                <SignalBadge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
                  Current international
                </SignalBadge>
              )}
              {trend && (
                <SignalBadge
                  className={
                    trend.type === "winner"
                      ? "border-accent-hot-border bg-accent-hot-glow text-accent-hot"
                      : "border-accent-cold-border bg-accent-cold-glow text-accent-cold-soft"
                  }
                >
                  {trend.type === "winner" ? (
                    <TrendingUp className="mr-1 h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="mr-1 h-3.5 w-3.5" />
                  )}
                  {trend.type === "winner" ? "Repeat riser" : "Repeat faller"}
                </SignalBadge>
              )}
            </div>

            <h1 className="mt-4 text-3xl font-pixel leading-tight text-text-primary sm:text-4xl">
              {player.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
              <PlayerSubtitle
                position={player.position}
                playedPosition={player.playedPosition}
                club={player.club}
                clubLogoUrl={player.clubLogoUrl}
                clubId={data.clubId ?? undefined}
                age={player.age}
                nationalityFlagUrl={player.nationalityFlagUrl}
                nationality={player.nationality}
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button asChild>
                <Link
                  href={`/value-analysis?id=${player.playerId}&name=${encodeURIComponent(player.name)}`}
                >
                  Compare on value
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-border-medium bg-elevated text-text-primary hover:bg-card-hover"
              >
                <a
                  href={getLeistungsdatenUrl(player.profileUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Transfermarkt profile
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
          <HeroMetric
            label="Value"
            value={player.marketValueDisplay}
            subline={`#${rankings.marketValueOverall} overall · #${rankings.marketValuePosition} ${positionLabel.toLowerCase()}`}
            accentClass="text-accent-gold"
          />
          <HeroMetric
            label="npG+A"
            value={String(form.seasonNpga)}
            subline={`#${rankings.npgaOverall} overall · #${rankings.npgaPosition} ${positionLabel.toLowerCase()}`}
            accentClass="text-accent-hot"
          />
          <HeroMetric
            label="G+A"
            value={String(form.seasonGa)}
            subline={`${form.seasonGoals}G · ${form.seasonAssists}A`}
            accentClass="text-emerald-400"
          />
          <HeroMetric
            label="Minutes"
            value={`${player.minutes.toLocaleString()}'`}
            subline={`Played ${player.totalMatches} of ${displayAvailable(player)}${signalSummary.availablePct < 100 ? ` · ${100 - signalSummary.availablePct}% missed` : ""}`}
            accentClass="text-accent-blue"
          />
        </div>

        <div className="col-span-full flex flex-wrap gap-2.5">
          <HeroSignalBadges
            signalSummaries={{
              all: comparisons.all.signalSummary,
              league: comparisons.league.signalSummary,
              noLeagueEdge: comparisons.noLeagueEdge.signalSummary,
              top5: comparisons.top5.signalSummary,
            }}
            leagueLabel={player.league}
          />
          {peersPlayingLess === 0 && peersPlayingMore >= MIN_COMPARISON_COUNT && (
            <SignalBadge className="border-accent-cold-border bg-accent-cold-glow text-accent-cold-soft">
              Fewest minutes among {peersPlayingMore} comparable peers
              <InfoTip className="ml-1">
                <p>
                  No player worth the same or more — with as many games available, in a
                  same-or-more-defensive role — has played fewer minutes than {player.name} this
                  season.
                </p>
                <p className="mt-1.5">
                  Meanwhile {peersPlayingMore} players worth the same or less, with no more
                  available games, have played more. Based on all tracked leagues — see the Minutes
                  section below.
                </p>
              </InfoTip>
            </SignalBadge>
          )}
          <Suspense>
            <PlayerInjuryBadge playerId={player.playerId} />
          </Suspense>
          {/* Any fee-vs-value list this player's move heads. Streamed beside the
              injury badge for the same reason: neither is worth making the hero
              wait on a scrape. */}
          <Suspense>
            <PlayerTransferBadges playerId={player.playerId} />
          </Suspense>
          {player.contractExpiry && (
            <SignalBadge className="border-border-subtle bg-card-hover text-text-secondary">
              Contract until {player.contractExpiry}
            </SignalBadge>
          )}
          {trend && (
            <Link href="/biggest-movers">
              <SignalBadge className="border-border-subtle bg-card-hover text-text-secondary transition-colors hover:text-text-primary">
                {trend.appearances.length} repeat {trend.type === "winner" ? "rises" : "drops"}
              </SignalBadge>
            </Link>
          )}
        </div>
      </DetailHero>

      <DetailDeck
        sections={[
          { value: "snapshot", label: "Snapshot" },
          { value: "comparisons", label: "Market comps" },
          { value: "minutes", label: "Minutes" },
        ]}
      >
        <div className="space-y-8">
          <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[1.06fr_0.94fr]">
            <SectionPanel title="Rankings">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-left">Metric</TableHead>
                    <TableHead className="text-right">All</TableHead>
                    <TableHead className="text-right">League</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">Club</TableHead>
                    <TableHead className="text-right whitespace-nowrap">
                      {positionShortLabel || positionLabel}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {RANKING_METRICS.map((m) => {
                    const base = `/players${m.sortKey ? `?sort=${m.sortKey}` : ""}`;
                    const sep = m.sortKey ? "&" : "?";
                    const posFilter = getBroadPositionFilter(effectivePosition(player));
                    return (
                      <TableRow key={m.label}>
                        <TableCell className="whitespace-nowrap">
                          <Link
                            href={base}
                            className="text-text-secondary transition-colors hover:text-text-primary hover:underline"
                          >
                            <span className="sm:hidden">{m.shortLabel}</span>
                            <span className="hidden sm:inline">{m.label}</span>
                          </Link>
                        </TableCell>
                        <RankCell rank={rankings[m.overallKey]} total={overallCount} href={base} />
                        <RankCell
                          rank={rankings[m.leagueKey]}
                          total={leagueCount}
                          href={`${base}${sep}league=${encodeURIComponent(player.league)}`}
                        />
                        <TableCell className="hidden sm:table-cell text-right whitespace-nowrap">
                          <Link
                            href={`${base}${sep}club=${encodeURIComponent(player.club)}`}
                            className="transition-opacity hover:opacity-70"
                          >
                            <RankBadge rank={rankings[m.clubKey]} total={clubCount} />
                          </Link>
                        </TableCell>
                        <RankCell
                          rank={rankings[m.positionKey]}
                          total={positionPeerCount}
                          href={`${base}${sep}pos=${posFilter}`}
                        />
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {subgroupRankings.length > 0 && (
                <div className="mt-4 space-y-3">
                  {subgroupRankings.map((group) => (
                    <Table key={group.label}>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-left">
                            {group.label} ({group.total})
                          </TableHead>
                          <TableHead className="text-right">npG+A</TableHead>
                          <TableHead className="text-right">Value</TableHead>
                          <TableHead className="text-right">Minutes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="text-text-secondary">Rank</TableCell>
                          <TableCell className="text-right font-value text-accent-hot">
                            #{group.npgaRank}
                          </TableCell>
                          <TableCell className="text-right font-value text-accent-gold">
                            #{group.marketValueRank}
                          </TableCell>
                          <TableCell className="text-right font-value text-accent-blue">
                            #{group.minutesRank}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  ))}
                </div>
              )}
            </SectionPanel>

            <SectionPanel title="Season">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-left">Period</TableHead>
                    <TableHead className="text-right">npG+A</TableHead>
                    <TableHead className="text-right">G</TableHead>
                    <TableHead className="text-right">A</TableHead>
                    <TableHead className="text-right">Mins</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    {
                      label: "Season",
                      npga: form.seasonNpga,
                      goals: form.seasonGoals,
                      pens: form.penaltyGoals,
                      assists: form.seasonAssists,
                      mins: form.seasonMinutes,
                    },
                    {
                      label: "Last 5",
                      npga: form.last5Npga,
                      goals: form.last5Goals,
                      pens: form.last5PenaltyGoals,
                      assists: form.last5Assists,
                      mins: form.last5Minutes,
                    },
                    {
                      label: "Last 10",
                      npga: form.last10Npga,
                      goals: form.last10Goals,
                      pens: form.last10PenaltyGoals,
                      assists: form.last10Assists,
                      mins: form.last10Minutes,
                    },
                  ].map((row) => (
                    <TableRow key={row.label}>
                      <TableCell className="text-text-secondary">{row.label}</TableCell>
                      <TableCell className="text-right font-value text-accent-hot">
                        {row.npga}
                      </TableCell>
                      <TableCell className="text-right font-value">
                        <GoalBreakdown goals={row.goals} penaltyGoals={row.pens} />
                      </TableCell>
                      <TableCell className="text-right font-value text-text-primary">
                        {row.assists}
                      </TableCell>
                      <TableCell className="text-right font-value text-text-primary">
                        {row.mins.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {form.penaltyAttempts > 0 && (
                <Link
                  href="/players?sort=pen"
                  className="mt-2.5 block text-sm text-text-secondary transition-colors hover:text-text-primary"
                >
                  Penalties:{" "}
                  <span className="font-value text-amber-400">
                    {form.penaltyGoals}/{form.penaltyAttempts}
                  </span>{" "}
                  scored
                  {form.penaltyConversion !== null && (
                    <>
                      {" "}
                      (
                      <span
                        className={`font-value ${form.penaltyConversion >= 80 ? "text-emerald-400" : form.penaltyConversion >= 60 ? "text-amber-400" : "text-red-400"}`}
                      >
                        {form.penaltyConversion}%
                      </span>
                      )
                    </>
                  )}
                  {penaltyRank && (
                    <>
                      {" "}
                      · <RankBadge rank={penaltyRank.rank} total={penaltyRank.total} /> of{" "}
                      {penaltyRank.total} takers
                    </>
                  )}
                </Link>
              )}
              {player.positionStats && player.positionStats.length > 1 && (
                <div className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-left">Position</TableHead>
                        <TableHead className="text-right">Apps</TableHead>
                        <TableHead className="text-right">G</TableHead>
                        <TableHead className="text-right">A</TableHead>
                        <TableHead className="text-right">npG+A</TableHead>
                        <TableHead className="text-right">Mins</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {player.positionStats.map((ps) => {
                        const npga = ps.goals - /* no penalty split per position */ 0 + ps.assists;
                        const bestNpga = Math.max(
                          ...player.positionStats!.map((p) => p.goals + p.assists),
                        );
                        const isBest = npga === bestNpga && player.positionStats!.length > 1;
                        return (
                          <TableRow key={ps.positionId}>
                            <TableCell className="text-text-secondary">{ps.position}</TableCell>
                            <TableCell className="text-right font-value text-text-primary">
                              {ps.appearances}
                            </TableCell>
                            <TableCell className="text-right font-value text-text-primary">
                              {ps.goals}
                            </TableCell>
                            <TableCell className="text-right font-value text-text-primary">
                              {ps.assists}
                            </TableCell>
                            <TableCell
                              className={`text-right font-value ${isBest ? "text-accent-hot" : "text-text-primary"}`}
                            >
                              {npga}
                            </TableCell>
                            <TableCell className="text-right font-value text-text-primary">
                              {ps.minutes.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </SectionPanel>
          </section>

          <SectionPanel
            title="Latest matches"
            aside={
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-[11px] text-text-muted">
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="hidden sm:inline">Open play</span>
                    <span className="sm:hidden">OP</span>
                  </span>
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                    <span className="hidden sm:inline">Penalty</span>
                    <span className="sm:hidden">Pen</span>
                  </span>
                </div>
                <div className="rounded-full border border-border-subtle bg-black/20 px-3 py-1.5 text-xs text-text-secondary whitespace-nowrap">
                  Last <span className="font-value text-text-primary">{fallbackMatchCount}</span>{" "}
                  matches
                </div>
              </div>
            }
          >
            <RecentMatches matches={player.recentForm ?? []} />
          </SectionPanel>
        </div>

        <ComparisonPanels
          comparisons={comparisons}
          initialScope={scope}
          leagueLabel={player.league}
          underBenchmarkUrl={`/value-analysis?id=${player.playerId}&name=${encodeURIComponent(player.name)}&tab=underdelivering`}
          overBenchmarkUrl={`/value-analysis?id=${player.playerId}&name=${encodeURIComponent(player.name)}&tab=better-value`}
        />

        {/* Minutes tab */}
        <MinutesBenchmarkSection
          benchmark={minutesBenchmark}
          playerId={player.playerId}
          playerName={player.name}
        />

        <section className="grid gap-4 lg:grid-cols-[0.34fr_0.66fr]">
          <SectionPanel title="Standing within the club">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-[1.35rem] border border-border-subtle bg-black/20 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted">
                  Tracked clubmates
                </p>
                <p className="mt-2 text-2xl font-value text-text-primary">{clubmates.length}</p>
                <p className="mt-1 text-sm text-text-secondary">
                  players currently in the stored club sample
                </p>
              </div>
              <div className="rounded-[1.35rem] border border-border-subtle bg-black/20 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted">
                  Club npG+A rank
                </p>
                <p className="mt-2 text-2xl font-value text-accent-gold">#{rankings.npgaClub}</p>
                <p className="mt-1 text-sm text-text-secondary">
                  inside {player.club}&apos;s tracked stack
                </p>
              </div>
              <div className="rounded-[1.35rem] border border-border-subtle bg-black/20 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted">
                  Market value rank
                </p>
                <p className="mt-2 text-2xl font-value text-text-primary">
                  #{rankings.marketValueClub}
                </p>
                <p className="mt-1 text-sm text-text-secondary">within the same club sample</p>
              </div>
            </div>
          </SectionPanel>

          <SectionPanel title={`Top performers at ${player.club}`}>
            <div className="grid gap-3 sm:grid-cols-2">
              {topClubmatesByNpga.map((clubmate, index) => (
                <ClubContextItem
                  key={clubmate.playerId}
                  player={clubmate}
                  rank={index + 1}
                  highlighted={clubmate.playerId === player.playerId}
                />
              ))}
            </div>
          </SectionPanel>
        </section>
      </DetailDeck>

      {player.fetchedAt && (
        <p className="mt-6 text-center text-xs text-text-muted">
          Stats updated {timeAgo(new Date(player.fetchedAt))}
        </p>
      )}
    </DetailPageShell>
  );
}
