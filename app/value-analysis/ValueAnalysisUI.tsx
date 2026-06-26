"use client";

import { useState, useMemo, useCallback, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { PlayerAutocomplete } from "@/components/PlayerAutocomplete";
import { Combobox } from "@/components/Combobox";
import { LeagueCombobox } from "@/components/LeagueCombobox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ExternalLink } from "lucide-react";
import { InfoTip } from "@/app/components/InfoTip";
import { FilterButton } from "@/components/FilterButton";
import { PositionDisplay } from "@/components/PositionDisplay";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { PlayerSubtitle } from "@/components/PlayerSubtitle";
import { NationalityFlag } from "@/components/NationalityFlag";
import { LeagueBadge } from "@/components/LeagueBadge";
import { VirtualList } from "@/components/VirtualList";
import {
  filterPlayersByLeagueAndClub,
  TOP_5_LEAGUES,
  buildLeagueValues,
  isSameOrStrongerLeague,
  displayAvailable,
  filterMinutesBenchmark,
  missedPct,
  uniqueFilterOptions,
} from "@/lib/filter-players";
import { countComparisons, findValueCandidates, MIN_COMPARISON_COUNT } from "@/lib/value-analysis";
import { applyStatsToggles, toPlayerStats } from "@/lib/stats-toggles";
import {
  formatReturnInfo,
  formatInjuryDuration,
  formatMarketValue,
  getLeistungsdatenUrl,
  getPlayerDetailHref,
} from "@/lib/format";
import { normalizeForSearch } from "@/lib/normalize";
import {
  effectivePosition,
  strictlyOutperforms,
  canBeUnderperformerAgainst,
  canBeOutperformerAgainst,
} from "@/lib/positions";
import { useQueryParams } from "@/lib/hooks/use-query-params";
import { BenchmarkCard, BigNumber } from "./BenchmarkCard";
import type { PlayerStats, MinutesValuePlayer, InjuryMap } from "@/app/types";

type Mode = "ga" | "mins";
type CompareTab = "less" | "more";
type DiscoverySortKey = "count" | "value-asc" | "value-desc" | "ga-desc" | "ga-asc";
const DISCOVERY_SORT_KEYS = new Set<string>([
  "count",
  "value-asc",
  "value-desc",
  "ga-desc",
  "ga-asc",
]);
function parseDiscoverySort(value: string | null): DiscoverySortKey {
  return value && DISCOVERY_SORT_KEYS.has(value) ? (value as DiscoverySortKey) : "count";
}
type DiscoveryTab = "overpriced" | "bargains";
type DiscoveryCandidate = PlayerStats & { comparisonCount: number };

const EMPTY_MV: MinutesValuePlayer[] = [];

// Ascending-bars glyph shared by the two "Same or stronger league" filters (league strength).
const strongerLeagueIcon = (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 19V14M9 19V11M14 19V8M19 19V5"
    />
  </svg>
);

function computeBenchmark(players: PlayerStats[], id: string, name: string) {
  const normalized = name ? normalizeForSearch(name) : "";
  const target =
    (id && players.find((p) => p.playerId === id)) ||
    (name && players.find((p) => normalizeForSearch(p.name).includes(normalized))) ||
    null;
  if (!target) return null;
  const tp = effectivePosition(target);
  return {
    targetPlayer: target,
    underperformers: players.filter(
      (p) =>
        p.playerId !== target.playerId &&
        p.marketValue >= target.marketValue &&
        strictlyOutperforms(target, p) &&
        canBeUnderperformerAgainst(effectivePosition(p), tp),
    ),
    outperformers: players
      .filter(
        (p) =>
          p.playerId !== target.playerId &&
          p.marketValue <= target.marketValue &&
          strictlyOutperforms(p, target) &&
          canBeOutperformerAgainst(effectivePosition(p), tp),
      )
      .sort((a, b) => b.points - a.points || a.marketValue - b.marketValue),
    totalPlayers: players.length,
  };
}

/* ── G+A Components ── */

function MinutesDisplay({ minutes }: { minutes?: number }) {
  return (
    <div className="flex items-center gap-2">
      <svg className="w-3.5 h-3.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="text-sm tabular-nums text-text-secondary">
        {minutes?.toLocaleString() || "—"}&apos;
      </span>
    </div>
  );
}

function TargetPlayerCard({ player, minutes }: { player: PlayerStats; minutes?: number }) {
  return (
    <BenchmarkCard
      name={player.name}
      imageUrl={player.imageUrl}
      href={getPlayerDetailHref(player.playerId)}
      subtitle={<PlayerSubtitle {...player} />}
      desktopStats={
        <>
          <span className="tabular-nums">{player.goals}G</span>
          <span className="tabular-nums">{player.assists}A</span>
          <span className="tabular-nums">{player.matches} games</span>
          <span className="text-text-secondary">Age {player.age}</span>
        </>
      }
      mobileStats={
        <>
          <span className="tabular-nums">{player.goals}G</span>
          <span className="tabular-nums">{player.assists}A</span>
          <span className="tabular-nums">{player.matches} games</span>
          <span className="text-text-secondary">Age {player.age}</span>
        </>
      }
      desktopBigNumbers={
        <>
          <BigNumber value={player.marketValueDisplay} label="Value" color="var(--accent-gold)" />
          <BigNumber value={String(player.points)} label="G+A" color="var(--accent-hot)" />
          <BigNumber
            value={`${minutes?.toLocaleString() || "—"}'`}
            label="Minutes"
            color="var(--accent-blue)"
          />
        </>
      }
      mobileBigNumbers={
        <>
          <div className="text-lg font-medium font-value text-accent-gold">
            {player.marketValueDisplay}
          </div>
          <div className="text-lg font-medium font-value text-accent-hot">{player.points}</div>
          <div className="text-lg font-medium font-value text-accent-blue">
            {minutes?.toLocaleString() || "—"}&apos;
          </div>
        </>
      }
    />
  );
}

interface CardTheme {
  gradientStart: string;
  border: string;
  rankBg: string;
  rankColor: string;
  imageBorder: string;
}

const CARD_THEMES = {
  cold: {
    gradientStart: "var(--accent-cold-faint)",
    border: "var(--accent-cold-glow)",
    rankBg: "var(--accent-cold-glow)",
    rankColor: "var(--accent-cold-soft)",
    imageBorder: "var(--accent-cold-border)",
  },
  hot: {
    gradientStart: "var(--accent-hot-faint)",
    border: "var(--accent-hot-glow)",
    rankBg: "var(--accent-hot-glow)",
    rankColor: "var(--accent-hot)",
    imageBorder: "var(--accent-hot-border)",
  },
  green: {
    gradientStart: "var(--accent-green-faint)",
    border: "var(--accent-green-glow)",
    rankBg: "var(--accent-green-glow)",
    rankColor: "var(--accent-green)",
    imageBorder: "var(--accent-green-border)",
  },
} as const satisfies Record<string, CardTheme>;

type ComparisonCardVariant = "underperformer" | "outperformer";

function PlayerCard({
  index = 0,
  theme,
  name,
  imageUrl,
  profileUrl,
  nameElement,
  subtitle,
  desktopStats,
  mobileStats,
  footer,
}: {
  index?: number;
  theme: CardTheme;
  name: string;
  imageUrl: string;
  profileUrl: string;
  nameElement: ReactNode;
  subtitle: ReactNode;
  desktopStats: ReactNode;
  mobileStats: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      className="group rounded-xl p-3 sm:p-4 animate-slide-up hover-lift"
      style={{
        background: `linear-gradient(135deg, ${theme.gradientStart} 0%, var(--bg-card) 100%)`,
        border: `1px solid ${theme.border}`,
        animationDelay: `${Math.min(index * 0.03, 0.3)}s`,
      }}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <div
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs sm:text-sm font-bold shrink-0"
          style={{ background: theme.rankBg, color: theme.rankColor }}
        >
          {index + 1}
        </div>
        <PlayerAvatar
          imageUrl={imageUrl}
          name={name}
          size="md"
          className="shrink-0"
          style={{ border: `1px solid ${theme.imageBorder}` }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {nameElement}
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 opacity-40 hover:opacity-100 transition-opacity text-text-muted"
            >
              <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </a>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs mt-0.5 flex-wrap text-text-secondary">
            {subtitle}
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-3 shrink-0">{desktopStats}</div>
        <div className="sm:hidden text-right shrink-0">{mobileStats}</div>
      </div>
      {footer && (
        <div className="flex items-center gap-2 sm:gap-3 mt-2 sm:mt-3 pt-2 sm:pt-3 text-xs border-t border-t-border-subtle">
          {footer}
        </div>
      )}
    </div>
  );
}

function ComparisonCard({
  player,
  targetPlayer,
  index = 0,
  variant,
}: {
  player: PlayerStats;
  targetPlayer: PlayerStats;
  index?: number;
  variant: ComparisonCardVariant;
}) {
  const theme = CARD_THEMES[variant === "underperformer" ? "cold" : "hot"];
  const mutedColor =
    variant === "underperformer" ? "var(--accent-cold-muted)" : "var(--accent-hot-muted)";
  const leistungsdatenUrl = getLeistungsdatenUrl(player.profileUrl);
  const minutes = player.minutes;

  let valueDeltaLabel: string;
  let pointsDeltaLabel: string;
  if (variant === "underperformer") {
    const valueDiff = player.marketValue - targetPlayer.marketValue;
    valueDeltaLabel =
      valueDiff >= 1_000_000
        ? `+€${(valueDiff / 1_000_000).toFixed(1)}m`
        : `+€${(valueDiff / 1_000).toFixed(0)}k`;
    pointsDeltaLabel = `−${targetPlayer.points - player.points}`;
  } else {
    const valueSaved = targetPlayer.marketValue - player.marketValue;
    valueDeltaLabel =
      valueSaved >= 1_000_000
        ? `€${(valueSaved / 1_000_000).toFixed(1)}m less`
        : valueSaved > 0
          ? `€${(valueSaved / 1_000).toFixed(0)}k less`
          : "Same value";
    pointsDeltaLabel = `+${player.points - targetPlayer.points}`;
  }

  return (
    <PlayerCard
      index={index}
      theme={theme}
      name={player.name}
      imageUrl={player.imageUrl}
      profileUrl={leistungsdatenUrl}
      nameElement={
        <Link
          href={getPlayerDetailHref(player.playerId)}
          className="font-semibold text-sm sm:text-base hover:underline truncate transition-colors text-text-primary"
        >
          {player.name}
        </Link>
      }
      subtitle={<PlayerSubtitle {...player} />}
      desktopStats={
        <>
          <div className="text-right">
            <div className="text-sm font-medium font-value" style={{ color: theme.rankColor }}>
              {player.marketValueDisplay}
            </div>
            <div className="text-xs font-medium tabular-nums" style={{ color: mutedColor }}>
              {valueDeltaLabel}
            </div>
          </div>
          <div className="w-px h-8 bg-border-subtle" />
          <div className="text-right min-w-[3rem]">
            <div className="text-sm font-medium font-value text-text-primary">
              {player.points} G+A
            </div>
            <div className="text-xs font-medium tabular-nums" style={{ color: theme.rankColor }}>
              {pointsDeltaLabel}
            </div>
          </div>
          <div className="w-px h-8 bg-border-subtle" />
          <div className="min-w-[4.5rem]">
            <MinutesDisplay minutes={minutes} />
          </div>
        </>
      }
      mobileStats={
        <>
          <div className="text-xs font-medium font-value" style={{ color: theme.rankColor }}>
            {player.marketValueDisplay}
          </div>
          <div className="text-xs tabular-nums text-text-primary">{player.points} G+A</div>
        </>
      }
      footer={
        <>
          <span className="tabular-nums text-text-secondary">{player.goals}G</span>
          <span className="tabular-nums text-text-secondary">{player.assists}A</span>
          <span className="tabular-nums text-text-secondary">{player.matches} games</span>
          <span className="sm:hidden tabular-nums text-text-secondary">{player.age}y</span>
          <div className="sm:hidden ml-auto">
            <MinutesDisplay minutes={minutes} />
          </div>
          <LeagueBadge league={player.league} variant="inline" />
        </>
      }
    />
  );
}

function DiscoveryListCard({
  player,
  index = 0,
  variant,
  pointsLabel = "G+A",
}: {
  player: DiscoveryCandidate;
  index?: number;
  variant: DiscoveryTab;
  pointsLabel?: string;
}) {
  const isOverpriced = variant === "overpriced";
  const theme = isOverpriced ? CARD_THEMES.cold : CARD_THEMES.green;
  const countColor = isOverpriced ? "var(--accent-hot)" : "var(--accent-green)";
  const countLabel = isOverpriced ? "cheaper & better" : "pricier & worse";
  const valueColor = isOverpriced ? "var(--accent-cold-soft)" : "var(--accent-green)";

  return (
    <PlayerCard
      index={index}
      theme={theme}
      name={player.name}
      imageUrl={player.imageUrl}
      profileUrl={getLeistungsdatenUrl(player.profileUrl)}
      nameElement={
        <Link
          href={getPlayerDetailHref(player.playerId)}
          className="font-semibold text-sm sm:text-base hover:underline truncate transition-colors text-text-primary"
        >
          {player.name}
        </Link>
      }
      subtitle={<PlayerSubtitle {...player} />}
      desktopStats={
        <>
          {player.comparisonCount > 0 && (
            <>
              <div className="text-right min-w-[4rem]">
                <div className="text-base font-value leading-none" style={{ color: countColor }}>
                  {player.comparisonCount}
                </div>
                <div className="text-xs text-text-secondary">{countLabel}</div>
              </div>
              <div className="w-px h-8 bg-border-subtle" />
            </>
          )}
          <div className="text-right">
            <div className="text-sm font-medium font-value" style={{ color: valueColor }}>
              {player.marketValueDisplay}
            </div>
            <div className="text-xs text-text-secondary">value</div>
          </div>
          <div className="w-px h-8 bg-border-subtle" />
          <div className="text-right min-w-[3rem]">
            <div className="text-sm font-medium font-value text-text-primary">
              {player.points} G+A
            </div>
            <div className="text-xs text-text-secondary">{pointsLabel}</div>
          </div>
          <div className="w-px h-8 bg-border-subtle" />
          <div className="text-right min-w-[4rem]">
            <div className="text-sm font-medium font-value text-accent-blue">
              {player.minutes?.toLocaleString() || "—"}&apos;
            </div>
            <div className="text-xs text-text-secondary">mins</div>
          </div>
        </>
      }
      mobileStats={<></>}
      footer={
        <>
          {/* Mobile: two-row footer using full width */}
          <div className="sm:hidden w-full flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              {player.comparisonCount > 0 && (
                <span className="font-value font-medium" style={{ color: countColor }}>
                  {player.comparisonCount} {countLabel}
                </span>
              )}
              <span className="ml-auto font-value font-medium" style={{ color: valueColor }}>
                {player.marketValueDisplay}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-value text-text-primary">
                {player.points} {pointsLabel}
              </span>
              <span className="tabular-nums text-text-secondary">{player.goals}G</span>
              <span className="tabular-nums text-text-secondary">{player.assists}A</span>
              <span className="tabular-nums text-text-secondary">{player.matches} games</span>
              <span className="tabular-nums text-text-secondary">{player.age}y</span>
              <span className="ml-auto tabular-nums text-accent-blue">
                {player.minutes?.toLocaleString() || "—"}&apos;
              </span>
            </div>
          </div>
          {/* Desktop: inline items */}
          <div className="hidden sm:contents">
            <span className="tabular-nums text-text-secondary">{player.goals}G</span>
            <span className="tabular-nums text-text-secondary">{player.assists}A</span>
            <span className="tabular-nums text-text-secondary">{player.matches} games</span>
            <LeagueBadge league={player.league} variant="inline" />
          </div>
        </>
      }
    />
  );
}

interface DiscoveryFilters {
  league: string;
  club: string;
  nationality: string;
  sameOrStronger: boolean;
}

type DiscoveryPrefix = "u" | "o";

/** Filter/sort props for one discovery section, mirrored to/from prefixed URL params (Overpriced "u" / Bargains "o"). */
function discoveryControls(
  prefix: DiscoveryPrefix,
  params: { get(key: string): string | null },
  update: (patch: Record<string, string | null>) => void,
) {
  return {
    sortBy: parseDiscoverySort(params.get(`${prefix}Sort`)),
    onSortChange: (value: DiscoverySortKey) =>
      update({ [`${prefix}Sort`]: value === "count" ? null : value }),
    filters: {
      league: params.get(`${prefix}League`) || "all",
      club: params.get(`${prefix}Club`) || "",
      nationality: params.get(`${prefix}Nat`) || "all",
      sameOrStronger: params.get(`${prefix}Stronger`) === "1",
    } satisfies DiscoveryFilters,
    onFilterChange: (f: Partial<DiscoveryFilters>) =>
      update({
        ...(f.league !== undefined && {
          [`${prefix}League`]: f.league === "all" ? null : f.league,
        }),
        ...(f.club !== undefined && { [`${prefix}Club`]: f.club || null }),
        ...(f.nationality !== undefined && {
          [`${prefix}Nat`]: f.nationality === "all" ? null : f.nationality,
        }),
        ...(f.sameOrStronger !== undefined && {
          [`${prefix}Stronger`]: f.sameOrStronger ? "1" : null,
        }),
      }),
  };
}

function DiscoverySection({
  variant,
  candidates,
  allPlayers,
  leagueValues,
  sortBy,
  onSortChange,
  filters,
  onFilterChange,
  pointsLabel = "G+A",
}: {
  variant: DiscoveryTab;
  candidates: DiscoveryCandidate[];
  allPlayers: PlayerStats[];
  leagueValues: Map<string, number>;
  sortBy: DiscoverySortKey;
  onSortChange: (value: DiscoverySortKey) => void;
  filters: DiscoveryFilters;
  onFilterChange: (patch: Partial<DiscoveryFilters>) => void;
  pointsLabel?: string;
}) {
  const {
    league: leagueFilter,
    club: clubFilter,
    nationality: nationalityFilter,
    sameOrStronger,
  } = filters;
  const isOverpriced = variant === "overpriced";
  const accentColor = isOverpriced ? "var(--accent-cold-soft)" : "var(--accent-green)";
  const isTop5 = leagueFilter === "top5";

  const clubOptions = useMemo(
    () => uniqueFilterOptions(candidates, (p) => p.club, "All clubs"),
    [candidates],
  );
  const nationalityOptions = useMemo(
    () => uniqueFilterOptions(candidates, (p) => p.nationality, "All nationalities"),
    [candidates],
  );

  const isSingleLeague = leagueFilter !== "all" && !isTop5;
  const scopedPool = useMemo(() => {
    if (isTop5) return allPlayers.filter((p) => TOP_5_LEAGUES.includes(p.league));
    if (isSingleLeague) return allPlayers.filter((p) => p.league === leagueFilter);
    return null;
  }, [allPlayers, isTop5, isSingleLeague, leagueFilter]);

  // Same-or-stronger peers for a league, cached so sort/club/nationality changes don't rebuild pools.
  const poolForLeague = useMemo(() => {
    const cache = new Map<string, PlayerStats[]>();
    return (league: string) => {
      let pool = cache.get(league);
      if (!pool) {
        pool = allPlayers.filter(isSameOrStrongerLeague(leagueValues, league));
        cache.set(league, pool);
      }
      return pool;
    };
  }, [allPlayers, leagueValues]);

  const filteredCandidates = useMemo(() => {
    let filtered = filterPlayersByLeagueAndClub(candidates, leagueFilter, clubFilter);
    if (nationalityFilter !== "all")
      filtered = filtered.filter((p) => p.nationality === nationalityFilter);
    if (sameOrStronger) {
      filtered = filtered
        .map((player) => ({
          ...player,
          comparisonCount: countComparisons(player, poolForLeague(player.league), !isOverpriced),
        }))
        .filter((p) => p.comparisonCount >= MIN_COMPARISON_COUNT);
    } else if (scopedPool) {
      filtered = filtered
        .map((player) => ({
          ...player,
          comparisonCount: countComparisons(player, scopedPool, !isOverpriced),
        }))
        .filter((p) => p.comparisonCount >= MIN_COMPARISON_COUNT);
    }
    const sorted = [...filtered];
    if (sortBy === "value-asc") return sorted.sort((a, b) => a.marketValue - b.marketValue);
    if (sortBy === "value-desc") return sorted.sort((a, b) => b.marketValue - a.marketValue);
    if (sortBy === "ga-desc") return sorted.sort((a, b) => b.points - a.points);
    if (sortBy === "ga-asc") return sorted.sort((a, b) => a.points - b.points);
    return sorted.sort((a, b) => b.comparisonCount - a.comparisonCount);
  }, [
    candidates,
    scopedPool,
    sameOrStronger,
    poolForLeague,
    leagueFilter,
    clubFilter,
    nationalityFilter,
    sortBy,
    isOverpriced,
  ]);

  const isValueActive = sortBy === "value-asc" || sortBy === "value-desc";
  const isGaActive = sortBy === "ga-asc" || sortBy === "ga-desc";
  const sortGroup = sortBy === "count" ? "count" : isValueActive ? "value" : "ga";

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full" style={{ background: accentColor }} />
          <h2
            className="text-sm sm:text-base font-pixel uppercase tracking-widest flex items-center gap-1.5"
            style={{ color: accentColor }}
          >
            {isOverpriced ? "Overpriced" : "Bargains"}
            <InfoTip>
              {isOverpriced
                ? "Expensive players who are outscored by 3+ cheaper players in the same or similar position. The count shows how many cheaper alternatives have matched or beaten their output."
                : "Lower-value players who outperform 3+ more expensive peers. The count shows how many pricier players they've matched or beaten on goals + assists in equal or fewer minutes."}
            </InfoTip>
          </h2>
        </div>
        {filteredCandidates.length > 0 && (
          <span
            className="text-sm font-bold px-2.5 py-1 rounded-lg tabular-nums"
            style={{
              background: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
              color: accentColor,
            }}
          >
            {filteredCandidates.length}
          </span>
        )}
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-text-muted">Sort</span>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={sortGroup}
            onValueChange={(v) => {
              if (v === "count") onSortChange("count");
              else if (v === "value") onSortChange(isOverpriced ? "value-desc" : "value-asc");
              else if (v === "ga") onSortChange("ga-desc");
              else if (isValueActive)
                onSortChange(sortBy === "value-asc" ? "value-desc" : "value-asc");
              else if (isGaActive) onSortChange(sortBy === "ga-desc" ? "ga-asc" : "ga-desc");
            }}
          >
            <ToggleGroupItem value="count" className="rounded-lg">
              {isOverpriced ? "Most underperforming" : "Most outperforming"}
            </ToggleGroupItem>
            <ToggleGroupItem value="value" className="rounded-lg">
              Value {isValueActive && (sortBy === "value-asc" ? "\u2191" : "\u2193")}
            </ToggleGroupItem>
            <ToggleGroupItem value="ga" className="rounded-lg">
              {pointsLabel} {isGaActive && (sortBy === "ga-desc" ? "\u2193" : "\u2191")}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="hidden sm:block w-px h-6 bg-border-subtle" />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
            Filter
          </span>
          <LeagueCombobox
            players={candidates}
            value={leagueFilter}
            onChange={(v) => onFilterChange({ league: v || "all", sameOrStronger: false })}
          />
          <FilterButton
            active={sameOrStronger}
            onClick={() => onFilterChange({ sameOrStronger: !sameOrStronger, league: "all" })}
          >
            {strongerLeagueIcon}
            Same or stronger league
          </FilterButton>
          <Combobox
            value={clubFilter || "all"}
            onChange={(v) => onFilterChange({ club: v === "all" ? "" : v })}
            options={clubOptions}
            placeholder="All clubs"
            searchPlaceholder="Search clubs..."
          />
          <Combobox
            value={nationalityFilter}
            onChange={(v) => onFilterChange({ nationality: v || "all" })}
            options={nationalityOptions}
            placeholder="All nationalities"
            searchPlaceholder="Search nationalities..."
          />
        </div>
      </div>
      {filteredCandidates.length === 0 && (
        <div className="rounded-xl p-8 text-center animate-fade-in bg-card border border-border-subtle">
          <p className="font-medium text-text-primary">
            {isOverpriced ? "No overpriced players found" : "No bargain players found"}
          </p>
          <p className="text-sm mt-1 text-text-muted">
            {isOverpriced
              ? "Every expensive player is producing as expected. Try broadening filters or switching leagues."
              : "No cheaper players are outperforming pricier peers right now. Try broadening filters."}
          </p>
        </div>
      )}
      {filteredCandidates.length > 0 && (
        <div className="space-y-3">
          {filteredCandidates.map((player, index) => (
            <DiscoveryListCard
              key={player.playerId}
              player={player}
              index={index}
              variant={variant}
              pointsLabel={pointsLabel}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Minutes Components ── */

function MvBenchmarkCard({ player }: { player: MinutesValuePlayer }) {
  const ga = player.goals + player.assists;
  const available = displayAvailable(player);
  const missedPctVal = Math.round(missedPct(player) * 100);
  return (
    <BenchmarkCard
      name={player.name}
      imageUrl={player.imageUrl}
      href={getPlayerDetailHref(player.playerId)}
      subtitle={<PlayerSubtitle {...player} />}
      desktopStats={
        <>
          <span className="tabular-nums">
            Played {player.totalMatches} of {available}
          </span>
          <span className="text-text-secondary">Age {player.age}</span>
        </>
      }
      mobileStats={
        <>
          <span className="tabular-nums">
            Played {player.totalMatches} of {available}
          </span>
          <span className="text-text-secondary">Age {player.age}</span>
        </>
      }
      desktopBigNumbers={
        <>
          <BigNumber value={player.marketValueDisplay} label="Value" color="var(--accent-gold)" />
          <BigNumber value={String(ga)} label="G+A" color="var(--accent-hot)" />
          <BigNumber
            value={`${player.minutes.toLocaleString()}'`}
            label="Minutes"
            color="var(--accent-blue)"
          />
          <BigNumber
            value={String(player.totalMatches)}
            label="Games"
            color="var(--text-primary)"
          />
          {missedPctVal > 0 && (
            <BigNumber value={`${missedPctVal}%`} label="Missed" color="var(--accent-cold-soft)" />
          )}
        </>
      }
      mobileBigNumbers={
        <>
          <div className="text-lg font-medium font-value text-accent-gold">
            {player.marketValueDisplay}
          </div>
          <div className="text-lg font-medium font-value text-accent-hot">{ga}</div>
          <div className="text-lg font-medium font-value text-accent-blue">
            {player.minutes.toLocaleString()}&apos;
          </div>
          <div className="text-lg font-medium font-value text-text-primary">
            {player.totalMatches}
          </div>
          {missedPctVal > 0 && (
            <div className="text-lg font-medium font-value text-accent-cold-soft">
              {missedPctVal}%
            </div>
          )}
        </>
      }
    />
  );
}

function MvPlayerCard({
  player,
  target,
  index,
  variant = "less",
  onSelect,
  injuryMap,
}: {
  player: MinutesValuePlayer;
  target?: MinutesValuePlayer;
  index: number;
  variant?: CompareTab;
  onSelect?: (p: MinutesValuePlayer) => void;
  injuryMap?: InjuryMap;
}) {
  const theme = variant === "less" ? CARD_THEMES.cold : CARD_THEMES.green;
  const valueDiff = target ? player.marketValue - target.marketValue : 0;
  const valueDiffDisplay =
    valueDiff > 0 ? `+${formatMarketValue(valueDiff)}` : formatMarketValue(valueDiff);
  const minsDiff = target ? player.minutes - target.minutes : 0;
  const available = displayAvailable(player);
  const missedPctVal = Math.round(missedPct(player) * 100);

  return (
    <PlayerCard
      index={index}
      theme={theme}
      name={player.name}
      imageUrl={player.imageUrl}
      profileUrl={getLeistungsdatenUrl(player.profileUrl)}
      nameElement={
        <button
          type="button"
          onClick={() => onSelect?.(player)}
          className="font-semibold text-sm sm:text-base hover:underline truncate transition-colors text-left text-text-primary"
        >
          {player.name}
        </button>
      }
      subtitle={
        <>
          <PositionDisplay
            position={player.position}
            playedPosition={player.playedPosition}
            abbreviated
          />
          {player.nationalityFlagUrl && (
            <>
              <span className="opacity-40">·</span>
              <NationalityFlag url={player.nationalityFlagUrl} name={player.nationality} />
            </>
          )}
          {variant === "less" &&
            injuryMap?.[player.playerId] &&
            (() => {
              const info = injuryMap[player.playerId];
              const dur = formatInjuryDuration(info.injurySince);
              const ret = formatReturnInfo(info.returnDate);
              const parts = [info.injury, dur && `since ${dur}`, ret?.label].filter(Boolean);
              return (
                <>
                  <span className="opacity-40">·</span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-accent-cold-glow text-accent-cold-soft">
                    {parts.join(" · ")}
                  </span>
                </>
              );
            })()}
          <span className="hidden sm:inline opacity-40">·</span>
          <span className="hidden sm:inline">{player.age}y</span>
        </>
      }
      desktopStats={
        <>
          <div className="text-right">
            <div className="text-sm font-medium font-value" style={{ color: theme.rankColor }}>
              {player.marketValueDisplay}
            </div>
            {target && (
              <div
                className="text-xs font-medium tabular-nums"
                style={{ color: theme.rankColor, opacity: 0.7 }}
              >
                {valueDiffDisplay}
              </div>
            )}
          </div>
          <div className="w-px h-8 bg-border-subtle" />
          <div className="text-right">
            <div className="text-sm font-medium font-value text-accent-blue">
              {player.minutes.toLocaleString()}&apos;
            </div>
            {target && (
              <div className="text-xs font-medium tabular-nums" style={{ color: theme.rankColor }}>
                {variant === "more" ? "+" : "\u2212"}
                {Math.abs(minsDiff).toLocaleString()}&apos;
              </div>
            )}
          </div>
          <div className="w-px h-8 bg-border-subtle" />
          <div className="flex items-center gap-2.5 text-right">
            <div>
              <div className="text-sm font-medium font-value text-text-primary">
                {player.totalMatches}
              </div>
              <div className="text-xs text-text-secondary">played</div>
            </div>
            <div>
              <div className="text-sm font-medium font-value text-text-primary">{available}</div>
              <div className="text-xs text-text-secondary">available</div>
            </div>
          </div>
        </>
      }
      mobileStats={
        <>
          <div className="text-xs font-medium font-value" style={{ color: theme.rankColor }}>
            {player.marketValueDisplay}
          </div>
          <div className="text-xs tabular-nums text-accent-blue">
            {player.minutes.toLocaleString()}&apos;
          </div>
        </>
      }
      footer={
        <>
          <span className="tabular-nums text-text-secondary">
            Played {player.totalMatches} of {available}
          </span>
          {missedPctVal > 0 && (
            <span className="tabular-nums text-accent-cold-soft">{missedPctVal}% missed</span>
          )}
          <span className="sm:hidden tabular-nums text-text-secondary">{player.age}y</span>
          <LeagueBadge league={player.league} variant="inline" />
        </>
      }
    />
  );
}

/* ── Main Component ── */

interface ValueAnalysisUIProps {
  initialAllPlayers: PlayerStats[];
  initialData: MinutesValuePlayer[];
  injuryMap?: InjuryMap;
  initialUnderperformers: (PlayerStats & { outperformedByCount: number })[];
  initialOverperformers: (PlayerStats & { outperformsCount?: number })[];
}

const MIN_DISCOVERY_MINUTES = 260;

export function ValueAnalysisUI({
  initialAllPlayers,
  initialData,
  injuryMap,
  initialUnderperformers,
  initialOverperformers,
}: ValueAnalysisUIProps) {
  const { params, update, push } = useQueryParams("/value-analysis");

  const includePen = params.get("pen") === "1";

  const rawPlayerStats = useMemo(() => initialData.map(toPlayerStats), [initialData]);

  const { allPlayers, rawUnderCandidates, rawOverCandidates } = useMemo(() => {
    if (!includePen) {
      return {
        allPlayers: initialAllPlayers,
        rawUnderCandidates: initialUnderperformers.map((p) => ({
          ...p,
          comparisonCount: p.outperformedByCount,
        })),
        rawOverCandidates: initialOverperformers.map((p) => ({
          ...p,
          comparisonCount: p.outperformsCount || 0,
        })),
      };
    }
    const players = applyStatsToggles(rawPlayerStats, { includePen });
    return {
      allPlayers: players,
      rawUnderCandidates: findValueCandidates(players, {
        candidateOutperforms: false,
        minMinutes: MIN_DISCOVERY_MINUTES,
        sortAsc: false,
      }).map((p) => ({ ...p, comparisonCount: p.count })),
      rawOverCandidates: findValueCandidates(players, {
        candidateOutperforms: true,
        sortAsc: true,
      }).map((p) => ({ ...p, comparisonCount: p.count })),
    };
  }, [
    rawPlayerStats,
    includePen,
    initialAllPlayers,
    initialUnderperformers,
    initialOverperformers,
  ]);

  const pointsLabel = includePen ? "G+A" : "npG+A";

  // Mode
  const mode: Mode = params.get("mode") === "mins" ? "mins" : "ga";
  const urlId = params.get("id") || "";
  const urlName = params.get("name") || "";
  const hasPlayer = !!(urlId || urlName);
  const [query, setQuery] = useState(urlName);
  useEffect(() => {
    setQuery(urlName);
  }, [urlName]);

  const handleSelect = useCallback(
    (id: string, name: string) => {
      push({ id, name });
    },
    [push],
  );
  const handleClear = useCallback(() => {
    push({ id: null, name: null, tab: null });
  }, [push]);

  // ── G+A benchmark state ──
  const benchStrongerOnly = params.get("bStronger") === "1";
  const benchSameLeagueOnly = params.get("bLeague") === "1";

  // ── Discovery state (Overpriced "u" / Bargains "o") ──
  const underControls = discoveryControls("u", params, update);
  const overControls = discoveryControls("o", params, update);

  // ── Discovery tab state ──
  const discoveryTab: DiscoveryTab = params.get("dTab") === "bargains" ? "bargains" : "overpriced";

  // ── Shared tab state (both modes use `tab` param since they're mutually exclusive) ──
  const gaTab = params.get("tab") === "better-value" ? "better-value" : "underdelivering";
  const minsTab: CompareTab = params.get("tab") === "more" ? "more" : "less";
  const minsLeagueFilter = params.get("mLeague") || "all";
  const minsClubFilter = params.get("mClub") || "";
  const maxMissedRaw = params.get("maxMiss") ? parseInt(params.get("maxMiss")!) : NaN;
  const maxMissedPct = Number.isNaN(maxMissedRaw) ? null : maxMissedRaw;
  const minsTop5Only = params.get("mTop5") === "1";

  // ── G+A benchmark (computed client-side from data already on the page) ──
  const gaData = useMemo(
    () => (mode === "ga" && hasPlayer ? computeBenchmark(allPlayers, urlId, urlName) : null),
    [mode, hasPlayer, urlId, urlName, allPlayers],
  );
  const gaHasResults = !!gaData?.targetPlayer;
  const targetMinutes = gaData?.targetPlayer?.minutes;

  const targetLeague = gaData?.targetPlayer?.league;
  const leagueValues = useMemo(() => buildLeagueValues(allPlayers), [allPlayers]);
  const benchScopePredicate = useMemo(() => {
    if (benchSameLeagueOnly && targetLeague) return (p: PlayerStats) => p.league === targetLeague;
    if (benchStrongerOnly && targetLeague)
      return isSameOrStrongerLeague(leagueValues, targetLeague);
    return null;
  }, [benchSameLeagueOnly, targetLeague, benchStrongerOnly, leagueValues]);

  const filteredUnderperformers = useMemo(
    () =>
      gaData?.underperformers
        ? benchScopePredicate
          ? gaData.underperformers.filter(benchScopePredicate)
          : gaData.underperformers
        : [],
    [gaData?.underperformers, benchScopePredicate],
  );
  const filteredOutperformers = useMemo(
    () =>
      gaData?.outperformers
        ? benchScopePredicate
          ? gaData.outperformers.filter(benchScopePredicate)
          : gaData.outperformers
        : [],
    [gaData?.outperformers, benchScopePredicate],
  );

  const benchPoolSummary = useMemo(() => {
    if (benchSameLeagueOnly && targetLeague) {
      const count = allPlayers.filter((p) => p.league === targetLeague).length;
      return `Analyzed ${count.toLocaleString()} players in ${targetLeague}`;
    }
    if (benchStrongerOnly && targetLeague) {
      const count = allPlayers.filter(isSameOrStrongerLeague(leagueValues, targetLeague)).length;
      return `Analyzed ${count.toLocaleString()} players in ${targetLeague} or stronger leagues`;
    }
    return `Analyzed ${gaData?.totalPlayers.toLocaleString()} players across top European leagues`;
  }, [
    benchSameLeagueOnly,
    benchStrongerOnly,
    targetLeague,
    allPlayers,
    leagueValues,
    gaData?.totalPlayers,
  ]);

  // ── Discovery tab counts ──
  const underTabCount = rawUnderCandidates.length;
  const overTabCount = rawOverCandidates.length;

  // ── Minutes player selection ──
  const minsSelected = useMemo(() => {
    if (!hasPlayer) return null;
    if (urlId) return initialData.find((p) => p.playerId === urlId) ?? null;
    return initialData.find((p) => p.name === urlName) ?? null;
  }, [hasPlayer, urlId, urlName, initialData]);

  const { playingLess, playingMore } = useMemo(() => {
    if (!minsSelected)
      return { playingLess: [] as MinutesValuePlayer[], playingMore: [] as MinutesValuePlayer[] };
    return filterMinutesBenchmark(initialData, minsSelected);
  }, [minsSelected, initialData]);

  // ── Minutes discovery list ──
  const minsClubOptions = useMemo(
    () => uniqueFilterOptions(initialData, (p) => p.club, "All clubs"),
    [initialData],
  );

  const minsDiscoveryList = useMemo(() => {
    let list = filterPlayersByLeagueAndClub(initialData, minsLeagueFilter, minsClubFilter);
    if (minsTop5Only) list = list.filter((p) => TOP_5_LEAGUES.includes(p.league));
    if (maxMissedPct !== null)
      list = list.filter((p) => Math.round(missedPct(p) * 100) <= maxMissedPct);
    return [...list].sort((a, b) => a.minutes - b.minutes);
  }, [initialData, minsLeagueFilter, minsClubFilter, minsTop5Only, maxMissedPct]);

  const handleMvSelect = useCallback(
    (p: MinutesValuePlayer) => {
      setQuery(p.name);
      handleSelect(p.playerId, p.name);
    },
    [handleSelect],
  );

  return (
    <>
      {/* Title */}
      <div className="mb-4 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-pixel mb-1 sm:mb-2 text-text-primary">
          Over/<span className="text-accent-gold">Under</span>
        </h1>
        <p className="text-sm sm:text-base text-text-muted">
          {mode === "ga"
            ? `Are expensive players worth it? Compare any player's goals and assists against cheaper alternatives — based on ${includePen ? "G+A" : "G+A (excl. penalties)"}.`
            : "Expensive players ranked by fewest minutes. Search any player to find peers playing more or fewer minutes than them."}
        </p>
      </div>

      {/* Mode toggle + stat toggles */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(v) => {
            if (!v) return;
            push({ mode: v === "ga" ? null : v, tab: null, bStronger: null, bLeague: null });
          }}
        >
          <ToggleGroupItem value="ga" className="px-4">
            Goals + Assists
          </ToggleGroupItem>
          <ToggleGroupItem value="mins" className="px-4">
            Minutes
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="w-px h-6 bg-border-subtle" />
        <FilterButton active={includePen} onClick={() => update({ pen: includePen ? null : "1" })}>
          Include penalties
        </FilterButton>
      </div>

      {/* Search */}
      <div className="mb-6 sm:mb-8">
        {mode === "ga" ? (
          <PlayerAutocomplete<PlayerStats>
            players={allPlayers}
            value={query}
            onChange={(val) => {
              setQuery(val);
              if (!val.trim()) handleClear();
            }}
            onSelect={(player) => {
              setQuery(player.name);
              handleSelect(player.playerId, player.name);
            }}
            placeholder="Search player (e.g. Kenan Yildiz)"
            renderTrailing={(player) => (
              <div className="text-xs tabular-nums shrink-0 text-accent-hot">
                {player.points} G+A
              </div>
            )}
          />
        ) : (
          <PlayerAutocomplete<MinutesValuePlayer>
            players={minsSelected ? EMPTY_MV : initialData}
            value={query}
            onChange={(val) => {
              setQuery(val);
              if (!val.trim() || val !== minsSelected?.name) handleClear();
            }}
            onSelect={(player) => {
              setQuery(player.name);
              handleSelect(player.playerId, player.name);
            }}
            placeholder="Search player (e.g. Kenan Yildiz)"
            renderTrailing={(player) => (
              <div className="text-xs tabular-nums shrink-0 text-accent-blue">
                {player.minutes.toLocaleString()}&apos;
              </div>
            )}
          />
        )}
      </div>

      {/* ══════════════════ G+A MODE ══════════════════ */}
      {mode === "ga" && (
        <>
          {/* Not found */}
          {hasPlayer && !gaData?.targetPlayer && (
            <div className="rounded-xl p-5 mb-6 animate-fade-in bg-accent-cold-faint border border-accent-cold-glow">
              <p className="font-medium text-accent-cold-soft">Player not found</p>
              <p className="text-sm mt-1 text-text-secondary">
                Searched for &ldquo;{urlName || urlId}&rdquo; across {allPlayers.length} players
              </p>
            </div>
          )}

          {/* Benchmark */}
          {gaHasResults && (
            <div className="space-y-6">
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-5 rounded-full bg-accent-gold" />
                  <h2 className="text-xs font-pixel font-bold uppercase tracking-widest text-accent-gold">
                    Benchmark Player
                  </h2>
                </div>
                <TargetPlayerCard player={gaData!.targetPlayer} minutes={targetMinutes} />
              </section>

              <div className="flex flex-wrap items-center gap-2">
                <FilterButton
                  active={benchStrongerOnly}
                  onClick={() =>
                    update({ bStronger: benchStrongerOnly ? null : "1", bLeague: null })
                  }
                >
                  {strongerLeagueIcon}
                  Same or stronger league
                </FilterButton>
                <FilterButton
                  active={benchSameLeagueOnly}
                  onClick={() =>
                    update({ bLeague: benchSameLeagueOnly ? null : "1", bStronger: null })
                  }
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 8h14M5 12h14M5 16h14"
                    />
                  </svg>
                  Same league only
                </FilterButton>
              </div>

              <p className="text-xs text-text-muted flex items-start gap-1.5">
                <span>
                  Players at the same position or higher value. &ldquo;Underdelivering&rdquo; =
                  costs more, produces the same or fewer G+A. &ldquo;Better Value&rdquo; = costs
                  less, produces the same or more G+A.
                </span>
                <InfoTip className="mt-0.5 shrink-0">
                  <p>
                    We compare players in <strong>similar attacking positions</strong> (e.g.
                    strikers vs. wingers, but not defenders).
                  </p>
                  <p className="mt-1.5">
                    A player must be outperformed by <strong>3 or more</strong> cheaper players to
                    be flagged as underdelivering. This avoids one-off flukes.
                  </p>
                  <p className="mt-1.5">
                    The comparison uses non-penalty goals + assists and minutes played — a player
                    must match or beat on both metrics, not just one.
                  </p>
                </InfoTip>
              </p>

              <Tabs
                value={gaTab}
                onValueChange={(v) => push({ tab: v === "underdelivering" ? null : v })}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="underdelivering" className="flex-1 gap-2">
                    Underdelivering
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md tabular-nums bg-accent-cold-glow text-accent-cold-soft">
                      {filteredUnderperformers.length}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="better-value" className="flex-1 gap-2">
                    Better Value
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md tabular-nums bg-accent-hot-glow text-accent-hot">
                      {filteredOutperformers.length}
                    </span>
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="underdelivering">
                  {filteredUnderperformers.length === 0 ? (
                    <div className="rounded-xl p-6 sm:p-8 animate-fade-in bg-accent-cold-faint border border-accent-cold-border">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-accent-cold-glow">
                          <svg
                            className="w-5 h-5 text-accent-cold-soft"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-base text-accent-cold-soft">
                            Nobody more expensive is doing worse
                          </p>
                          <p className="text-sm mt-1 text-text-muted">
                            Every player worth {gaData!.targetPlayer.marketValueDisplay} or more has
                            produced more G+A. At {gaData!.targetPlayer.points} G+A for{" "}
                            {gaData!.targetPlayer.marketValueDisplay}, {gaData!.targetPlayer.name}{" "}
                            has the lowest output at this price range.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredUnderperformers.map((player, index) => (
                        <ComparisonCard
                          key={player.playerId}
                          player={player}
                          targetPlayer={gaData!.targetPlayer}
                          variant="underperformer"
                          index={index}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="better-value">
                  {filteredOutperformers.length === 0 ? (
                    <div className="rounded-xl p-6 sm:p-8 animate-fade-in bg-accent-hot-faint border border-accent-hot-border">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-accent-hot-glow">
                          <svg
                            className="w-5 h-5 text-accent-hot"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-base text-accent-hot">
                            {gaData!.targetPlayer.name} is a top performer for their price
                          </p>
                          <p className="text-sm mt-1 text-text-muted">
                            No cheaper player has produced more goal contributions in the same or
                            fewer minutes. At {gaData!.targetPlayer.points} G+A for{" "}
                            {gaData!.targetPlayer.marketValueDisplay}, {gaData!.targetPlayer.name}{" "}
                            offers excellent value.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredOutperformers.map((player, index) => (
                        <ComparisonCard
                          key={player.playerId}
                          player={player}
                          targetPlayer={gaData!.targetPlayer}
                          variant="outperformer"
                          index={index}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <div className="text-center py-6 text-xs animate-fade-in text-text-muted [animation-delay:0.3s]">
                {benchPoolSummary}
              </div>
            </div>
          )}

          {/* Discovery */}
          {!gaData && (
            <Tabs
              value={discoveryTab}
              onValueChange={(v) => update({ dTab: v === "overpriced" ? null : v })}
            >
              <TabsList className="w-full mb-6">
                <TabsTrigger value="overpriced" className="flex-1 gap-2">
                  Overpriced
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md tabular-nums bg-accent-cold-glow text-accent-cold-soft">
                    {underTabCount ?? "—"}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="bargains" className="flex-1 gap-2">
                  Bargains
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md tabular-nums bg-accent-green-glow text-accent-green">
                    {overTabCount ?? "—"}
                  </span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="overpriced">
                <DiscoverySection
                  variant="overpriced"
                  candidates={rawUnderCandidates}
                  allPlayers={allPlayers}
                  leagueValues={leagueValues}
                  pointsLabel={pointsLabel}
                  {...underControls}
                />
              </TabsContent>
              <TabsContent value="bargains">
                <DiscoverySection
                  variant="bargains"
                  candidates={rawOverCandidates}
                  allPlayers={allPlayers}
                  leagueValues={leagueValues}
                  pointsLabel={pointsLabel}
                  {...overControls}
                />
              </TabsContent>
            </Tabs>
          )}
        </>
      )}

      {/* ══════════════════ MINUTES MODE ══════════════════ */}
      {mode === "mins" && (
        <>
          {/* Benchmark */}
          {minsSelected && (
            <div className="space-y-8">
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-5 rounded-full bg-accent-gold" />
                  <h2 className="text-xs font-pixel font-bold uppercase tracking-widest text-accent-gold">
                    Benchmark Player
                  </h2>
                </div>
                <MvBenchmarkCard player={minsSelected} />
              </section>

              <p className="text-xs text-text-muted flex items-start gap-1.5">
                <span>
                  Comparing against players who have missed the same % of games or fewer — so
                  injured or suspended players don&apos;t skew the comparison.
                </span>
                <InfoTip className="mt-0.5 shrink-0">
                  <p>
                    <strong>&ldquo;Missed %&rdquo;</strong> is the share of their team&apos;s total
                    matches the player has been unavailable for (injury, suspension, etc.).
                  </p>
                  <p className="mt-1.5">
                    &ldquo;Playing Less&rdquo; shows equally or more expensive players getting fewer
                    minutes. &ldquo;Playing More&rdquo; shows equally or cheaper players getting
                    more minutes despite fewer available games.
                  </p>
                </InfoTip>
              </p>

              <section>
                <Tabs value={minsTab} onValueChange={(v) => push({ tab: v === "less" ? null : v })}>
                  <TabsList className="w-full mb-4">
                    <TabsTrigger value="less" className="flex-1 gap-2">
                      Playing Less
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md tabular-nums bg-accent-cold-glow text-accent-cold-soft">
                        {playingLess.length}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="more" className="flex-1 gap-2">
                      Playing More
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md tabular-nums bg-accent-green-glow text-accent-green">
                        {playingMore.length}
                      </span>
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="less">
                    {playingLess.length === 0 ? (
                      <div className="rounded-xl p-10 text-center animate-fade-in bg-card border border-border-subtle">
                        <p className="font-medium text-lg text-text-primary">No results</p>
                        <p className="text-sm mt-1 text-text-muted">
                          No same-or-higher value players have fewer minutes than{" "}
                          {minsSelected.name}
                        </p>
                      </div>
                    ) : (
                      <VirtualList
                        key={minsSelected?.playerId}
                        items={playingLess}
                        estimateSize={130}
                        gap={12}
                        keyExtractor={(p) => p.playerId}
                        renderItem={(p, i) => (
                          <MvPlayerCard
                            player={p}
                            target={minsSelected}
                            index={i}
                            variant="less"
                            onSelect={handleMvSelect}
                            injuryMap={injuryMap}
                          />
                        )}
                      />
                    )}
                  </TabsContent>
                  <TabsContent value="more">
                    {playingMore.length === 0 ? (
                      <div className="rounded-xl p-10 text-center animate-fade-in bg-card border border-border-subtle">
                        <p className="font-medium text-lg text-text-primary">No results</p>
                        <p className="text-sm mt-1 text-text-muted">
                          No same-or-lower value players have more minutes than {minsSelected.name}
                        </p>
                      </div>
                    ) : (
                      <VirtualList
                        key={minsSelected?.playerId}
                        items={playingMore}
                        estimateSize={130}
                        gap={12}
                        keyExtractor={(p) => p.playerId}
                        renderItem={(p, i) => (
                          <MvPlayerCard
                            player={p}
                            target={minsSelected}
                            index={i}
                            variant="more"
                            onSelect={handleMvSelect}
                          />
                        )}
                      />
                    )}
                  </TabsContent>
                </Tabs>
              </section>

              <div className="text-center py-6 text-xs animate-fade-in text-text-muted [animation-delay:0.3s]">
                Analyzed {initialData.length.toLocaleString()} players by market value
              </div>
            </div>
          )}

          {/* Discovery */}
          {!minsSelected && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 rounded-full bg-accent-cold" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-accent-cold-soft flex items-center gap-1.5">
                    Fewest Minutes
                    <InfoTip>
                      <p>
                        High-value players ranked by fewest minutes played — potential wasted
                        investment or players returning from injury.
                      </p>
                      <p className="mt-1.5">
                        Use the &ldquo;missed&rdquo; filters to exclude players who missed a large
                        share of games (so you see fit but benched players, not just injured ones).
                      </p>
                    </InfoTip>
                  </h2>
                </div>
                {minsDiscoveryList.length > 0 && (
                  <span className="text-sm font-bold px-2.5 py-1 rounded-lg tabular-nums bg-accent-cold-glow text-accent-cold-soft">
                    {minsDiscoveryList.length}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-4">
                <span className="hidden sm:inline text-xs font-medium uppercase tracking-wider text-text-muted">
                  Filter
                </span>
                <LeagueCombobox
                  players={initialData}
                  value={minsLeagueFilter}
                  onChange={(v) => update({ mLeague: v === "all" ? null : v || null })}
                />
                <Combobox
                  value={minsClubFilter || "all"}
                  onChange={(v) => update({ mClub: v === "all" ? null : v || null })}
                  options={minsClubOptions}
                  placeholder="All clubs"
                  searchPlaceholder="Search clubs..."
                />
                <FilterButton
                  active={minsTop5Only}
                  onClick={() => update({ mTop5: minsTop5Only ? null : "1" })}
                >
                  Top 5
                </FilterButton>
                {[25, 50].map((pct) => (
                  <FilterButton
                    key={pct}
                    active={maxMissedPct === pct}
                    onClick={() => update({ maxMiss: maxMissedPct === pct ? null : String(pct) })}
                  >
                    ≤{pct}% missed
                  </FilterButton>
                ))}
              </div>

              <VirtualList
                key={`${minsLeagueFilter}-${minsClubFilter}-${minsTop5Only}-${maxMissedPct}`}
                items={minsDiscoveryList}
                estimateSize={130}
                gap={12}
                keyExtractor={(p) => p.playerId}
                renderItem={(p, i) => (
                  <MvPlayerCard
                    player={p}
                    index={i}
                    variant="less"
                    onSelect={handleMvSelect}
                    injuryMap={injuryMap}
                  />
                )}
              />
            </section>
          )}
        </>
      )}
    </>
  );
}
