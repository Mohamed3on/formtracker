"use client";

import { useMemo, useRef, useState, useEffect, useCallback, type ReactNode } from "react";
import { VirtualList } from "@/components/VirtualList";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { NationalityFlag } from "@/components/NationalityFlag";
import { Combobox } from "@/components/Combobox";
import { LeagueCombobox } from "@/components/LeagueCombobox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { RangeFilter } from "@/components/RangeFilter";
import { FilterButton } from "@/components/FilterButton";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { InfoTip } from "@/app/components/InfoTip";
import { PositionDisplay, POS_ABBREV } from "@/components/PositionDisplay";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { useQueryParams } from "@/lib/hooks/use-query-params";
import { cn } from "@/lib/utils";
import { getLeagueUrl } from "@/lib/leagues";
import { includeTournamentStats, npga } from "@/lib/stats-toggles";
import {
  matchesPositionFilter,
  positionFilterCategory,
  positionsInFilterCategory,
} from "@/lib/positions";
import {
  filterPlayersByLeagueAndClub,
  getFormMinutes,
  uniqueFilterOptions,
} from "@/lib/filter-players";
import {
  extractClubIdFromLogoUrl,
  formatReturnInfo,
  formatInjuryDuration,
  getLeistungsdatenUrl,
  getPlayerDetailHref,
  getTeamDetailHref,
} from "@/lib/format";
import type { MinutesValuePlayer, InjuryMap } from "@/app/types";

type SortKey = "value" | "mins" | "games" | "ga" | "pen" | "miss";
type SigningFilter = "transfer" | "loan" | null;

function contractExpiryYear(expiry?: string): number | null {
  if (!expiry) return null;
  const year = parseInt(expiry.split("/").pop()!);
  return isNaN(year) ? null : year;
}

const BASE_SORT_LABELS: Record<SortKey, string> = {
  value: "Value",
  mins: "Mins",
  games: "Games",
  ga: "G+A",
  pen: "Pen",
  miss: "Miss",
};

type FormWindow = "season" | 10 | 5;

interface FormGAResult {
  total: number;
  goals: number;
  assists: number;
}

function getFormGA(
  player: MinutesValuePlayer,
  window: FormWindow,
  includePen: boolean,
): FormGAResult {
  if (window === "season") {
    const penAdj = includePen ? 0 : (player.penaltyGoals ?? 0);
    return {
      total: npga(player, { includePenalties: includePen }),
      goals: player.goals - penAdj,
      assists: player.assists,
    };
  }
  const games = (player.recentForm ?? []).slice(0, window);
  const goals = games.reduce((s, g) => s + g.goals - (includePen ? 0 : g.penaltyGoals), 0);
  const assists = games.reduce((s, g) => s + g.assists, 0);
  return { total: goals + assists, goals, assists };
}

/** Count badge that pops on value change */
function AnimatedCount({ value }: { value: number }) {
  const [popKey, setPopKey] = useState(0);
  const prevValue = useRef(value);
  useEffect(() => {
    if (value !== prevValue.current) {
      prevValue.current = value;
      setPopKey((k) => k + 1);
    }
  }, [value]);
  return (
    <span
      key={popKey}
      className="text-xs font-bold px-2 py-0.5 rounded-md tabular-nums text-accent-blue bg-accent-blue/15 animate-count-pop"
    >
      {value}
    </span>
  );
}

function AvatarBadge({
  bgClass,
  icon,
  tooltip,
  position = "bottom-right",
}: {
  bgClass: string;
  icon: ReactNode;
  tooltip: string;
  position?: "bottom-right" | "top-right";
}) {
  const pos = position === "top-right" ? "-top-1 -right-1" : "-bottom-1 -right-1";
  return (
    <div
      className={`absolute ${pos} w-4 h-4 sm:w-[18px] sm:h-[18px] rounded-full flex items-center justify-center group/badge before:content-[''] before:absolute before:-inset-2 ${bgClass}`}
      aria-label={tooltip}
      role="img"
      tabIndex={0}
    >
      {icon}
      <span className="pointer-events-none invisible group-hover/badge:visible group-focus/badge:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap z-[100] bg-elevated text-text-primary border border-border-subtle shadow-[0_0_0_2px_var(--bg-card),0_4px_12px_rgba(0,0,0,0.4)]">
        {tooltip}
      </span>
    </div>
  );
}

function LeagueChip({ league, logoUrl }: { league: string; logoUrl: string }) {
  const href = getLeagueUrl(league);
  const inner = (
    <>
      <img
        src={logoUrl}
        alt={league}
        title={league}
        className="w-3.5 h-3.5 object-contain rounded-sm bg-white/90 p-px shrink-0"
      />
      <span className="hidden md:inline">{league}</span>
    </>
  );
  return href ? (
    <Link
      href={href}
      className="flex items-center gap-1.5 hover:underline hover:text-text-primary transition-colors"
    >
      {inner}
    </Link>
  ) : (
    <span className="flex items-center gap-1.5">{inner}</span>
  );
}

function ClubChip({ club, logoUrl }: { club: string; logoUrl?: string }) {
  const clubId = extractClubIdFromLogoUrl(logoUrl);
  const inner = (
    <>
      {logoUrl && <img src={logoUrl} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />}
      {club}
    </>
  );
  return clubId ? (
    <Link
      href={getTeamDetailHref(clubId)}
      className="truncate inline-flex items-center gap-1 hover:underline"
    >
      {inner}
    </Link>
  ) : (
    <span className="truncate inline-flex items-center gap-1">{inner}</span>
  );
}

function NationalityChip({
  nationality,
  flagUrl,
  calledUp,
  onSelect,
}: {
  nationality?: string;
  flagUrl?: string;
  calledUp?: boolean;
  onSelect: (nationality: string) => void;
}) {
  // With no flag there is nothing left to show on mobile, where the name is hidden.
  const layout = `${flagUrl ? "flex" : "hidden md:flex"} items-center gap-1.5 shrink-0`;
  const inner = (
    <>
      <NationalityFlag url={flagUrl} name={nationality} calledUp={calledUp} />
      <span className="hidden md:inline">{nationality}</span>
    </>
  );
  return nationality ? (
    <button
      type="button"
      onClick={() => onSelect(nationality)}
      aria-label={`Show only players from ${nationality}`}
      className={`${layout} hover:underline hover:text-text-primary transition-colors`}
    >
      {inner}
    </button>
  ) : (
    <span className={layout}>{inner}</span>
  );
}

interface CardContext {
  sortBy: SortKey;
  showCaps: boolean;
  includePen: boolean;
  showContract: boolean;
  formWindow: FormWindow;
  formGA: (player: MinutesValuePlayer) => number;
  onNationality: (nationality: string) => void;
}

function PlayerCard({
  player,
  index,
  injuryMap,
  ctx,
}: {
  player: MinutesValuePlayer;
  index: number;
  injuryMap?: InjuryMap;
  ctx: CardContext;
}) {
  const { sortBy, showCaps, includePen, showContract, formWindow } = ctx;
  const expiryYear = contractExpiryYear(player.contractExpiry);
  const penGoals = player.penaltyGoals ?? 0;
  const penMisses = player.penaltyMisses ?? 0;
  const penAttempts = penGoals + penMisses;
  const isRecent = formWindow !== "season";
  const seasonGA = getFormGA(player, "season", includePen);
  const recentGA = isRecent ? getFormGA(player, formWindow, includePen) : null;
  const displayMinutes = isRecent ? getFormMinutes(player, formWindow) : player.minutes;
  const injuryInfo = injuryMap?.[player.playerId];
  const detailHref = getPlayerDetailHref(player.playerId);

  let nationalityDisplay: ReactNode = null;
  if (player.nationalityFlagUrl || player.nationality) {
    nationalityDisplay = (
      <>
        <span className={player.nationalityFlagUrl ? "opacity-40" : "hidden md:inline opacity-40"}>
          ·
        </span>
        <NationalityChip
          nationality={player.nationality}
          flagUrl={player.nationalityFlagUrl}
          calledUp={player.isCurrentIntl}
          onSelect={ctx.onNationality}
        />
      </>
    );
  }

  // Status badge (loan/signing) at top-right, injury badge at bottom-right — both can coexist
  const statusBadge = player.isOnLoan ? (
    <AvatarBadge
      position={injuryInfo ? "top-right" : "bottom-right"}
      bgClass="bg-accent-gold/90"
      tooltip="On loan"
      icon={
        <svg
          className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-black"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
          />
        </svg>
      }
    />
  ) : player.isNewSigning ? (
    <AvatarBadge
      position={injuryInfo ? "top-right" : "bottom-right"}
      bgClass="bg-accent-hot/85"
      tooltip="New signing"
      icon={
        <svg
          className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-black"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 19.5v-15m0 0l-6.75 6.75M12 4.5l6.75 6.75"
          />
        </svg>
      }
    />
  ) : null;

  let injuryBadge: ReactNode = null;
  if (injuryInfo) {
    const dur = formatInjuryDuration(injuryInfo.injurySince);
    const ret = formatReturnInfo(injuryInfo.returnDate);
    const tip = [injuryInfo.injury, dur && `out ${dur}`, ret?.label].filter(Boolean).join(" · ");
    injuryBadge = (
      <AvatarBadge
        position="bottom-right"
        bgClass="bg-rose-500/90"
        tooltip={tip}
        icon={
          <svg
            className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m-8-8h16" />
          </svg>
        }
      />
    );
  }

  return (
    <div
      className="group relative z-0 hover:z-10 rounded-xl p-2.5 sm:p-3 animate-slide-up hover-lift bg-card border border-border-subtle"
      style={{ animationDelay: `${Math.min(index * 0.03, 0.3)}s` }}
    >
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center text-[10px] sm:text-xs font-bold shrink-0 text-accent-blue bg-accent-blue/15">
          {index + 1}
        </div>

        <div className="relative shrink-0">
          <PlayerAvatar
            imageUrl={player.imageUrl}
            name={player.name}
            className="w-9 h-9 sm:w-10 sm:h-10 border border-border-subtle"
          />
          {statusBadge}
          {injuryBadge}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Link
              href={detailHref}
              className="font-semibold text-sm hover:underline truncate transition-colors text-left text-text-primary"
            >
              {player.name}
            </Link>
            <a
              href={getLeistungsdatenUrl(player.profileUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 opacity-40 hover:opacity-100 transition-opacity text-text-muted"
            >
              <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </a>
          </div>
          <div className="flex items-center gap-1.5 text-xs mt-0.5 overflow-hidden text-text-secondary">
            <PositionDisplay position={player.position} playedPosition={player.playedPosition} />
            <span className="opacity-40">·</span>
            <ClubChip club={player.club} logoUrl={player.clubLogoUrl} />
            {player.leagueLogoUrl && (
              <>
                <span className="opacity-40">·</span>
                <LeagueChip league={player.league} logoUrl={player.leagueLogoUrl} />
              </>
            )}
            {nationalityDisplay}
            <span className="hidden md:inline opacity-40">·</span>
            <span className="hidden md:inline">{player.age}y</span>
          </div>
        </div>

        {/* Desktop metrics — context-aware based on active sort/filters */}
        <div className="hidden sm:flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-sm font-medium font-value text-accent-blue">
              {player.marketValueDisplay}
            </div>
          </div>
          <div className="w-px h-7 bg-border-subtle" />
          <div className="text-right">
            <div className="text-sm font-value text-text-primary">
              {displayMinutes.toLocaleString()}&apos;
            </div>
          </div>
          {showCaps && (
            <div className="text-right">
              <div className="text-sm font-value text-text-primary">
                {player.intlCareerCaps ?? 0}
              </div>
              <div className="text-xs text-text-secondary">intl caps</div>
            </div>
          )}
          {showContract && expiryYear && (
            <div className="text-right">
              <div className="text-sm font-value text-text-primary">{expiryYear}</div>
              <div className="text-xs text-text-secondary">expires</div>
            </div>
          )}
          {(sortBy === "pen" || sortBy === "miss" || includePen) && penAttempts > 0 && (
            <div className="text-right min-w-12">
              <div className="text-sm font-value text-text-primary">
                {penGoals}/{penAttempts}
              </div>
              <div className="text-xs text-text-secondary">
                pen conv. {Math.round((penGoals / penAttempts) * 100)}%
              </div>
            </div>
          )}
          {sortBy === "miss" && (
            <div className="text-right">
              <div className="text-sm font-value text-text-primary">{penMisses}</div>
              <div className="text-xs text-text-secondary">missed</div>
            </div>
          )}
          <div className="w-px h-7 bg-border-subtle" />
          <div className="flex items-center gap-2.5 text-right">
            <div>
              <div className="text-sm font-value text-text-primary">{player.totalMatches}</div>
              <div className="text-xs text-text-secondary">games</div>
            </div>
            <div>
              <div className="text-sm font-value text-text-primary">{seasonGA.total}</div>
              <div className="text-xs tabular-nums text-text-secondary">
                {seasonGA.goals}G {seasonGA.assists}A
              </div>
            </div>
            {recentGA && (
              <div>
                <div className="text-sm font-value text-accent-hot">{recentGA.total}</div>
                <div className="text-xs tabular-nums text-accent-hot/50">
                  {recentGA.goals}G {recentGA.assists}A
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile stat tray */}
      <div className="sm:hidden mt-2 bg-elevated rounded-lg px-2.5 py-2 flex items-baseline gap-x-2.5 gap-y-1 flex-wrap font-value">
        {recentGA && (
          <span className="text-sm text-accent-hot">
            {recentGA.total}{" "}
            <span className="text-[11px] text-accent-hot/60">last {formWindow}</span>
          </span>
        )}
        <span className={`text-sm ${!recentGA ? "text-accent-hot" : ""}`}>
          {seasonGA.total}{" "}
          <span className="text-[11px] text-accent-hot/60">{includePen ? "G+A" : "npG+A"}</span>
        </span>
        <span className="text-sm text-accent-blue">{player.marketValueDisplay}</span>
        <span className="text-xs text-text-muted">{player.age}y</span>
        {!recentGA && <span className="text-xs text-text-muted">{player.totalMatches} games</span>}
        <span className="text-xs text-text-muted">{displayMinutes.toLocaleString()}&apos;</span>
        {showCaps && (player.intlCareerCaps ?? 0) > 0 && (
          <span className="text-xs text-text-muted">{player.intlCareerCaps} caps</span>
        )}
        {showContract && expiryYear && (
          <span className="text-xs text-text-muted">exp {expiryYear}</span>
        )}
        {(sortBy === "pen" || sortBy === "miss" || includePen) && penAttempts > 0 && (
          <span className="text-xs text-text-muted">
            {penGoals}/{penAttempts} pen
          </span>
        )}
      </div>
    </div>
  );
}

function parseSortKey(v: string | null): SortKey {
  if (v === "value" || v === "mins" || v === "games" || v === "ga" || v === "pen" || v === "miss")
    return v;
  return "ga";
}

function parseFormWindow(v: string | null): FormWindow {
  if (v === "5") return 5;
  if (v === "10") return 10;
  return "season";
}

function parseSigningFilter(v: string | null): SigningFilter {
  if (v === "transfer" || v === "loan") return v;
  return null;
}

const CATEGORY_LABELS: Record<string, string> = { att: "ATT", mid: "MID", def: "DEF", gk: "GK" };

export function PlayersUI({
  initialData: rawPlayers,
  injuryMap,
}: {
  initialData: MinutesValuePlayer[];
  injuryMap?: InjuryMap;
}) {
  const { params, update } = useQueryParams("/players");
  // Open on desktop until the reader says otherwise. The viewport is read after
  // hydration, not in the initial state: the server can't see it, and guessing
  // from `window` there painted a closed panel on the server and an open one on
  // the client — a hydration mismatch React repaired by regenerating the tree.
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const [moreChoice, setMoreChoice] = useState<boolean | null>(null);
  const moreOpen = moreChoice ?? isDesktop;
  const [isFiltering, setIsFiltering] = useState(false);

  const sortBy = parseSortKey(params.get("sort"));
  const sortAsc = params.get("dir") === "asc";
  const formWindow = parseFormWindow(params.get("fw"));
  const leagueFilter = params.get("league") || (params.get("top5") === "1" ? "top5" : "all");
  const clubFilter = params.get("club") || "all";
  const nationalityFilter = params.get("nat") || "all";
  const positionFilter = params.get("pos") || "";
  const activeCategory = positionFilterCategory(positionFilter);
  const specificPosition =
    activeCategory && positionFilter !== activeCategory ? positionFilter : null;
  const categoryPositions = activeCategory ? positionsInFilterCategory(activeCategory) : [];
  const signingFilter = parseSigningFilter(params.get("signing"));
  const includePen = params.get("pen") === "1";
  const excludeCurrentIntl = params.get("xcintl") === "1";
  const minCaps = params.get("mincaps") ? parseInt(params.get("mincaps")!) : null;
  const maxCaps = params.get("maxcaps") ? parseInt(params.get("maxcaps")!) : null;
  const minAge = params.get("minage") ? parseInt(params.get("minage")!) : null;
  const maxAge = params.get("maxage") ? parseInt(params.get("maxage")!) : null;
  const contractYear = params.get("contract") ? parseInt(params.get("contract")!) : null;

  // Auto-open "More filters" when any advanced filter is active
  const advancedFilterCount = [
    signingFilter !== null,
    excludeCurrentIntl,
    minCaps !== null || maxCaps !== null,
    minAge !== null || maxAge !== null,
    contractYear !== null,
    includePen,
  ].filter(Boolean).length;

  useEffect(() => {
    if (advancedFilterCount > 0) setMoreChoice(true);
  }, [advancedFilterCount]);

  const fadeUpdate = useCallback(
    (p: Parameters<typeof update>[0]) => {
      setIsFiltering(true);
      update(p);
    },
    [update],
  );

  // Fold major-tournament national-team stats into season totals (always on).
  const players = useMemo(() => rawPlayers.map(includeTournamentStats), [rawPlayers]);

  const nationalityOptions = useMemo(
    () => uniqueFilterOptions(players, (p) => p.nationality, "All nationalities"),
    [players],
  );
  const clubOptions = useMemo(
    () => uniqueFilterOptions(players, (p) => p.club, "All clubs"),
    [players],
  );

  const contractYearOptions = useMemo(() => {
    const years = Array.from(
      new Set(
        players
          .map((p) => contractExpiryYear(p.contractExpiry))
          .filter((y): y is number => y !== null),
      ),
    ).sort((a, b) => a - b);
    return [
      { value: "all", label: "Contract expiry" },
      ...years.map((y) => ({ value: String(y), label: `\u2264 ${y}` })),
    ];
  }, [players]);

  const pointsLabel = includePen ? "G+A" : "npG+A";

  const signingCounts = useMemo(() => {
    let base = filterPlayersByLeagueAndClub(players, leagueFilter, clubFilter);
    if (nationalityFilter !== "all") base = base.filter((p) => p.nationality === nationalityFilter);
    if (positionFilter) base = base.filter((p) => matchesPositionFilter(p, positionFilter));
    return {
      newSignings: base.filter((p) => p.isNewSigning).length,
      loans: base.filter((p) => p.isOnLoan).length,
    };
  }, [players, leagueFilter, clubFilter, nationalityFilter, positionFilter]);

  const sortedPlayers = useMemo(() => {
    let list = filterPlayersByLeagueAndClub(players, leagueFilter, clubFilter);
    if (nationalityFilter !== "all") list = list.filter((p) => p.nationality === nationalityFilter);
    if (positionFilter !== "all")
      list = list.filter((p) => matchesPositionFilter(p, positionFilter));
    if (signingFilter === "transfer") list = list.filter((p) => p.isNewSigning);
    if (signingFilter === "loan") list = list.filter((p) => p.isOnLoan);
    if (excludeCurrentIntl) list = list.filter((p) => !p.isCurrentIntl);
    if (minCaps !== null) list = list.filter((p) => (p.intlCareerCaps ?? 0) >= minCaps);
    if (maxCaps !== null) list = list.filter((p) => (p.intlCareerCaps ?? 0) <= maxCaps);
    if (minAge !== null) list = list.filter((p) => p.age >= minAge);
    if (maxAge !== null) list = list.filter((p) => p.age <= maxAge);
    if (contractYear !== null)
      list = list.filter((p) => {
        if (p.isOnLoan) return false;
        const y = contractExpiryYear(p.contractExpiry);
        return y !== null && y <= contractYear;
      });
    return [...list].sort((a, b) => {
      let diff: number;
      switch (sortBy) {
        case "mins":
          diff = b.minutes - a.minutes;
          break;
        case "games":
          diff = b.totalMatches - a.totalMatches;
          break;
        case "ga":
          diff =
            getFormGA(b, formWindow, includePen).total - getFormGA(a, formWindow, includePen).total;
          if (diff === 0) diff = getFormMinutes(a, formWindow) - getFormMinutes(b, formWindow);
          break;
        case "pen":
          diff = (b.penaltyGoals ?? 0) - (a.penaltyGoals ?? 0);
          break;
        case "miss":
          diff = (b.penaltyMisses ?? 0) - (a.penaltyMisses ?? 0);
          break;
        default:
          diff = b.marketValue - a.marketValue;
      }
      return sortAsc ? -diff : diff;
    });
  }, [
    players,
    sortBy,
    sortAsc,
    leagueFilter,
    clubFilter,
    nationalityFilter,
    positionFilter,
    signingFilter,
    includePen,
    excludeCurrentIntl,
    minCaps,
    maxCaps,
    minAge,
    maxAge,
    contractYear,
    formWindow,
  ]);

  return (
    <>
      <div className="mb-4 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-pixel mb-1 sm:mb-2 text-text-primary">
          Player <span className="text-accent-blue">Explorer</span>
        </h1>
        <p className="text-sm sm:text-base text-text-muted">
          The top 500 most valuable players in world football plus top scorers in Europe&apos;s top
          5 leagues.
        </p>
      </div>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 rounded-full shrink-0 bg-accent-blue" />
          <h2 className="text-xs font-pixel font-bold uppercase tracking-widest shrink-0 text-text-secondary">
            All Players
          </h2>
          <AnimatedCount value={sortedPlayers.length} />
        </div>

        {/* Sort */}
        <div className="flex flex-col gap-2 mb-5 sm:flex-row sm:items-center sm:gap-2 sm:overflow-x-auto">
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            <div className="flex items-center gap-2 w-max">
              <InfoTip>
                <p>
                  <strong>Value</strong> — market value (Transfermarkt estimate)
                </p>
                <p className="mt-1">
                  <strong>Mins</strong> — total minutes played this season
                </p>
                <p className="mt-1">
                  <strong>Games</strong> — total matches this season
                </p>
                <p className="mt-1">
                  <strong>G+A / npG+A</strong> — goals + assists. &ldquo;np&rdquo; means non-penalty
                  (excl. penalty goals) for a truer picture of open-play output
                </p>
                <p className="mt-1">
                  <strong>Pen</strong> — penalty goals scored
                </p>
                <p className="mt-1">
                  <strong>Miss</strong> — penalties missed
                </p>
              </InfoTip>
              <ToggleGroup
                type="single"
                value={sortBy}
                onValueChange={(value) => {
                  setIsFiltering(true);
                  if (!value) {
                    update({ dir: sortAsc ? null : "asc" });
                    return;
                  }
                  update({
                    sort: value === "ga" ? null : value,
                    dir: null,
                    ...(value !== "ga" && { fw: null }),
                  });
                }}
                className="rounded-lg overflow-hidden border border-border-subtle"
              >
                {(["value", "ga", "mins", "games", "pen", "miss"] as const).map((key) => (
                  <ToggleGroupItem
                    key={key}
                    value={key}
                    className="px-2.5 py-2 sm:py-1 text-[10px] sm:text-xs font-medium uppercase tracking-wide rounded-none border-0 flex items-center gap-1 text-text-muted data-[state=on]:bg-elevated data-[state=on]:text-text-primary"
                  >
                    {key === "ga" ? pointsLabel : BASE_SORT_LABELS[key]}
                    {sortBy === key && <span className="text-[10px]">{sortAsc ? "▲" : "▼"}</span>}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>
          {sortBy === "ga" && (
            <div className="flex items-center gap-2">
              <ToggleGroup
                type="single"
                value={String(formWindow)}
                onValueChange={(v) => {
                  if (!v) return;
                  setIsFiltering(true);
                  update({ fw: v === "season" ? null : v });
                }}
                className="rounded-lg overflow-hidden border border-border-subtle"
              >
                {(["season", 10, 5] as const).map((w) => (
                  <ToggleGroupItem
                    key={w}
                    value={String(w)}
                    className="px-2.5 py-2 sm:py-1 text-[10px] sm:text-xs font-medium rounded-none border-0 text-text-muted data-[state=on]:bg-elevated data-[state=on]:text-text-primary"
                  >
                    {w === "season" ? "Season" : `Last ${w}`}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <InfoTip>
                <p>
                  <strong>Season</strong> — full season totals
                </p>
                <p className="mt-1">
                  <strong>Last 10 / Last 5</strong> — stats from only the player&apos;s most recent
                  matches. Useful for spotting who&apos;s in form right now vs. their season
                  average.
                </p>
              </InfoTip>
            </div>
          )}
        </div>

        {/* Position */}
        <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 mb-5">
          <div className="flex items-center gap-2 w-max">
            <ToggleGroup
              type="single"
              value={activeCategory ?? ""}
              onValueChange={(v) => {
                setIsFiltering(true);
                update({ pos: v || null });
              }}
              className="rounded-lg overflow-hidden border border-border-subtle"
            >
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <ToggleGroupItem
                  key={key}
                  value={key}
                  className="px-2.5 py-2 sm:py-1 text-[10px] sm:text-xs font-medium uppercase tracking-wide rounded-none border-0 text-text-muted data-[state=on]:bg-elevated data-[state=on]:text-text-primary"
                >
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {activeCategory && categoryPositions.length > 1 && (
              <ToggleGroup
                type="single"
                value={specificPosition ?? ""}
                onValueChange={(v) => {
                  setIsFiltering(true);
                  update({ pos: v || activeCategory });
                }}
                className="rounded-lg overflow-hidden border border-border-subtle"
              >
                {categoryPositions.map((p) => (
                  <ToggleGroupItem
                    key={p}
                    value={p}
                    className="px-2.5 py-2 sm:py-1 text-[10px] sm:text-xs font-medium rounded-none border-0 text-text-muted data-[state=on]:bg-elevated data-[state=on]:text-text-primary"
                  >
                    {POS_ABBREV[p] || p}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 mb-5">
          {/* Primary filters */}
          <div className="flex flex-wrap items-center gap-2">
            <LeagueCombobox
              players={players}
              value={leagueFilter}
              onChange={(v) => {
                setIsFiltering(true);
                update({ league: v === "all" ? null : v || null, top5: null });
              }}
            />
            <Combobox
              value={clubFilter}
              onChange={(v) => {
                setIsFiltering(true);
                update({ club: v === "all" ? null : v || null });
              }}
              options={clubOptions}
              placeholder="All clubs"
              searchPlaceholder="Search clubs..."
            />
            <Combobox
              value={nationalityFilter}
              onChange={(v) => {
                setIsFiltering(true);
                update({ nat: v === "all" ? null : v || null });
              }}
              options={nationalityOptions}
              placeholder="All nationalities"
              searchPlaceholder="Search nationalities..."
            />
          </div>

          {/* Advanced filters — collapsible */}
          <Collapsible open={moreOpen} onOpenChange={setMoreChoice}>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-colors duration-150 text-text-muted hover:text-text-secondary">
              <svg
                className={cn(
                  "w-3.5 h-3.5 transition-transform duration-200",
                  moreOpen && "rotate-90",
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              More filters
              {advancedFilterCount > 0 && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md tabular-nums text-accent-blue bg-accent-blue/15">
                  {advancedFilterCount}
                </span>
              )}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex flex-wrap items-center gap-y-2 gap-x-3 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <RangeFilter
                    label="Age"
                    min={minAge}
                    max={maxAge}
                    onMinChange={(v) => {
                      setIsFiltering(true);
                      update({ minage: v });
                    }}
                    onMaxChange={(v) => {
                      setIsFiltering(true);
                      update({ maxage: v });
                    }}
                  />
                  <Combobox
                    value={contractYear !== null ? String(contractYear) : "all"}
                    onChange={(v) => {
                      setIsFiltering(true);
                      update({ contract: v === "all" ? null : v || null });
                    }}
                    options={contractYearOptions}
                    placeholder="Contract expiry"
                  />
                  <FilterButton
                    active={signingFilter === "transfer"}
                    onClick={() =>
                      fadeUpdate({
                        signing: signingFilter === "transfer" ? null : "transfer",
                        new: null,
                      })
                    }
                  >
                    Signings
                    <span className="tabular-nums text-text-secondary">
                      {signingCounts.newSignings}
                    </span>
                  </FilterButton>
                  <FilterButton
                    active={signingFilter === "loan"}
                    onClick={() =>
                      fadeUpdate({ signing: signingFilter === "loan" ? null : "loan", new: null })
                    }
                  >
                    Loans
                    <span className="tabular-nums text-text-secondary">{signingCounts.loans}</span>
                  </FilterButton>
                </div>
                <div className="w-px h-6 self-center bg-border-subtle hidden sm:block" />
                <div className="flex items-center gap-2">
                  <FilterButton
                    active={excludeCurrentIntl}
                    onClick={() => fadeUpdate({ xcintl: excludeCurrentIntl ? null : "1" })}
                  >
                    Excl. called-up
                  </FilterButton>
                  <RangeFilter
                    label="Caps"
                    min={minCaps}
                    max={maxCaps}
                    onMinChange={(v) => {
                      setIsFiltering(true);
                      update({ mincaps: v });
                    }}
                    onMaxChange={(v) => {
                      setIsFiltering(true);
                      update({ maxcaps: v });
                    }}
                  />
                </div>
                <div className="w-px h-6 self-center bg-border-subtle hidden sm:block" />
                <div className="flex items-center gap-2">
                  <FilterButton
                    active={includePen}
                    onClick={() => fadeUpdate({ pen: includePen ? null : "1" })}
                  >
                    Include penalties
                  </FilterButton>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div
          className={isFiltering ? "animate-filter-dim" : ""}
          onAnimationEnd={() => setIsFiltering(false)}
        >
          <VirtualList
            key={`${sortBy}-${formWindow}-${includePen}`}
            items={sortedPlayers}
            estimateSize={110}
            gap={8}
            keyExtractor={(p) => p.playerId}
            renderItem={(p, i) => (
              <PlayerCard
                player={p}
                index={i}
                injuryMap={injuryMap}
                ctx={{
                  sortBy,
                  showCaps: minCaps !== null || maxCaps !== null || excludeCurrentIntl,
                  includePen,
                  showContract: contractYear !== null,
                  formWindow,
                  formGA: (pl) => getFormGA(pl, formWindow, includePen).total,
                  onNationality: (nat) => fadeUpdate({ nat }),
                }}
              />
            )}
          />
        </div>
      </section>
    </>
  );
}
