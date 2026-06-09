"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ManagerInfo, TeamFormEntry } from "@/app/types";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ManagerSection, ManagerSkeleton } from "@/app/components/ManagerPPGBadge";
import { InfoTip } from "@/app/components/InfoTip";
import { LEAGUES, getLeagueLogoUrl } from "@/lib/leagues";
import { FormLeaderPill } from "@/components/FormLeaderPill";
import { LeagueBadge } from "@/components/LeagueBadge";
import { RankBadge } from "@/components/RankBadge";
import { formatValueStr, getTeamDetailHref, ordinal } from "@/lib/format";
import { useQueryParams } from "@/lib/hooks/use-query-params";
import { useManagersMap } from "@/lib/hooks/use-manager-query";
import { splitPerformers } from "@/lib/team-form";
import { TeamGapBars } from "./TeamGapBars";

export interface TeamFormResponse {
  success: boolean;
  allTeams: TeamFormEntry[];
  leagues: string[];
}

interface TeamFormUIProps {
  initialData: TeamFormResponse;
  formLeaders?: Record<string, { type: "top" | "bottom"; count: number }>;
}

function LeagueFilter({
  selectedLeague,
  onValueChange,
}: {
  selectedLeague: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="mb-4 sm:mb-6">
      <p className="text-sm font-medium mb-3 text-text-secondary">Filter by league:</p>
      <ToggleGroup
        type="single"
        value={selectedLeague}
        onValueChange={(value) => onValueChange(value || "all")}
        className="flex flex-wrap gap-2"
      >
        <ToggleGroupItem
          value="all"
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-150 border border-border-subtle text-text-muted hover:text-text-secondary hover:bg-card/50 active:scale-[0.97] data-[state=on]:bg-card data-[state=on]:border-accent-blue data-[state=on]:text-accent-blue data-[state=on]:shadow-[0_0_12px_rgba(88,166,255,0.2)]"
        >
          All Leagues
        </ToggleGroupItem>

        {LEAGUES.map((league) => (
          <ToggleGroupItem
            key={league.code}
            value={league.name}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-150 flex items-center gap-2 border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-card-hover active:scale-[0.97]"
            style={
              selectedLeague === league.name
                ? {
                    backgroundColor: league.hex,
                    borderColor: league.hex,
                    color: league.textOnBg === "text-black" ? "#000" : "#fff",
                    boxShadow: `0 0 12px ${league.hex}40`,
                  }
                : undefined
            }
          >
            <img
              src={getLeagueLogoUrl(league.name)}
              alt=""
              className="w-4 h-4 object-contain rounded-sm bg-white p-px"
            />
            {league.name}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

interface TeamCardProps {
  team: TeamFormEntry;
  rank: number;
  type: "over" | "under";
  index?: number;
  formLeader?: { type: "top" | "bottom"; count: number };
  manager?: ManagerInfo | null;
  managerLoading?: boolean;
}

function TeamCard({
  team,
  rank,
  type,
  index = 0,
  formLeader,
  manager,
  managerLoading,
}: TeamCardProps) {
  const isOver = type === "over";

  return (
    <Card
      className="h-full w-full overflow-hidden hover-lift animate-slide-up"
      style={{ animationDelay: `${Math.min(index * 0.03, 0.3)}s` }}
    >
      <div className="flex items-stretch h-full">
        {/* Main content */}
        <div className="flex-1 min-w-0 p-3 sm:p-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <RankBadge
              rank={rank}
              highlightClass={isOver ? "bg-green-600 text-white" : "bg-red-600 text-white"}
            />

            {/* Club Logo */}
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden shrink-0 flex items-center justify-center p-1 bg-white shadow-sm">
              {team.logoUrl ? (
                <img src={team.logoUrl} alt={team.name} className="w-full h-full object-contain" />
              ) : (
                <div className="text-xl text-text-muted">?</div>
              )}
            </div>

            {/* Team Info */}
            <div className="flex-1 min-w-0">
              <Link
                href={getTeamDetailHref(team.clubId)}
                className="font-semibold text-sm sm:text-base hover:underline block truncate text-text-primary"
              >
                {team.name}
              </Link>
              <div className="flex items-center gap-1.5 mt-0.5">
                <LeagueBadge league={team.league} />
                {formLeader && <FormLeaderPill type={formLeader.type} />}
              </div>
            </div>
          </div>

          {/* Stats Row — actual vs expected, color-coded */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2.5 text-xs sm:text-sm">
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-value ${isOver ? "bg-green-600/10 text-green-500" : "bg-red-600/10 text-red-500"}`}
            >
              {ordinal(team.leaguePosition)} · {team.points}pts
            </span>
            <span className="text-[10px] text-text-muted">vs</span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-elevated text-text-muted">
              <span className="font-value">
                {ordinal(team.marketValueRank)} · {team.expectedPoints}pts
              </span>
              <span className="hidden sm:inline text-xs text-text-secondary">
                by value
                {formatValueStr(team.marketValue) !== "-"
                  ? ` · ${formatValueStr(team.marketValue)}`
                  : ""}
              </span>
            </span>
          </div>

          {/* Manager info */}
          {managerLoading ? (
            <div className="mt-2 text-[11px] sm:text-sm">
              <ManagerSkeleton />
            </div>
          ) : (
            manager && (
              <div className="mt-2 text-[11px] sm:text-sm text-text-muted animate-fade-in">
                <ManagerSection manager={manager} />
              </div>
            )
          )}
        </div>

        {/* Delta strip */}
        <div
          className={`w-16 sm:w-20 flex flex-col items-center justify-center shrink-0 border-l ${isOver ? "border-l-green-600/20 bg-green-600/[0.06]" : "border-l-red-600/20 bg-red-600/[0.06]"}`}
        >
          <span
            className={`text-xl sm:text-2xl font-pixel ${isOver ? "text-green-600" : "text-red-600"}`}
          >
            {team.deltaPts > 0 ? `+${team.deltaPts}` : team.deltaPts}
          </span>
          <span
            className={`text-[8px] sm:text-[9px] uppercase tracking-wider mt-0.5 text-center leading-tight ${isOver ? "text-green-600/60" : "text-red-600/60"}`}
          >
            points
            <br />
            gap
          </span>
        </div>
      </div>
    </Card>
  );
}

// Component that renders both lists with aligned card rows
export function TeamListsGrid({
  overperformers,
  underperformers,
  formLeaders,
}: {
  overperformers: TeamFormEntry[];
  underperformers: TeamFormEntry[];
  formLeaders?: Record<string, { type: "top" | "bottom"; count: number }>;
}) {
  const displayedTeams = useMemo(
    () => [...overperformers, ...underperformers],
    [overperformers, underperformers],
  );
  const clubIds = useMemo(
    () => [...new Set(displayedTeams.map((t) => t.clubId).filter(Boolean))],
    [displayedTeams],
  );

  const { managersMap, loadingSet } = useManagersMap(clubIds);

  const maxLength = Math.max(overperformers.length, underperformers.length);

  const renderTeamCard = (
    team: TeamFormEntry,
    rank: number,
    type: "over" | "under",
    index: number,
  ) => (
    <TeamCard
      team={team}
      rank={rank}
      type={type}
      index={index}
      formLeader={formLeaders?.[team.clubId]}
      manager={managersMap[team.clubId]}
      managerLoading={loadingSet.has(team.clubId)}
    />
  );

  return (
    <div className="animate-fade-in">
      {/* Desktop: aligned grid rows */}
      <div className="hidden md:block">
        {/* Headers */}
        <div className="grid grid-cols-2 gap-6 mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg sm:text-xl font-pixel flex items-center gap-2 shrink-0 text-green-600">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Overperformers
              <InfoTip>
                <p>
                  Teams earning <strong>more points</strong> than their squad market value would
                  predict.
                </p>
                <p className="mt-1.5">
                  The &ldquo;points gap&rdquo; is calculated by ranking all teams in a league by
                  squad value, then comparing each team&apos;s actual points to the points earned by
                  the team sitting in that value-based position.
                </p>
                <p className="mt-1.5 text-text-muted">
                  &ldquo;Squad ranked 3rd, 58pts expected&rdquo; means the team has the 3rd most
                  valuable squad, and the team currently in 3rd has 58 points.
                </p>
              </InfoTip>
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full shrink-0 bg-green-600/10 text-green-600/70">
              {overperformers.length}
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-green-600/30" />
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg sm:text-xl font-pixel flex items-center gap-2 shrink-0 text-red-600">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Underperformers
              <InfoTip>
                <p>
                  Teams earning <strong>fewer points</strong> than their squad market value would
                  predict.
                </p>
                <p className="mt-1.5">
                  A negative points gap means the team is underdelivering relative to how much their
                  squad costs.
                </p>
              </InfoTip>
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full shrink-0 bg-red-600/10 text-red-600/70">
              {underperformers.length}
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-red-600/30" />
          </div>
        </div>

        {/* Card rows */}
        <div className="space-y-3">
          {Array.from({ length: maxLength }).map((_, idx) => {
            const overTeam = overperformers[idx];
            const underTeam = underperformers[idx];

            return (
              <div key={idx} className="grid grid-cols-2 gap-6 items-stretch">
                <div className="flex">
                  {overTeam ? renderTeamCard(overTeam, idx + 1, "over", idx) : <div />}
                </div>
                <div className="flex">
                  {underTeam ? renderTeamCard(underTeam, idx + 1, "under", idx) : <div />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: stacked lists */}
      <div className="md:hidden space-y-6">
        {/* Overperformers */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-lg font-pixel flex items-center gap-2 shrink-0 text-green-600">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Overperformers
              <InfoTip>
                <p>
                  Teams earning <strong>more points</strong> than their squad market value would
                  predict.
                </p>
                <p className="mt-1.5">
                  The &ldquo;points gap&rdquo; compares actual points to the points earned by the
                  team sitting in the equivalent value-based position.
                </p>
              </InfoTip>
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full shrink-0 bg-green-600/10 text-green-600/70">
              {overperformers.length}
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-green-600/30" />
          </div>
          <div className="space-y-3">
            {overperformers.map((team, idx) => (
              <div key={`${team.name}-${team.league}`}>
                {renderTeamCard(team, idx + 1, "over", idx)}
              </div>
            ))}
          </div>
        </div>

        {/* Underperformers */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-lg font-pixel flex items-center gap-2 shrink-0 text-red-600">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Underperformers
              <InfoTip>
                <p>
                  Teams earning <strong>fewer points</strong> than their squad market value would
                  predict.
                </p>
                <p className="mt-1.5">
                  A negative points gap means the team is underdelivering relative to how much their
                  squad costs.
                </p>
              </InfoTip>
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full shrink-0 bg-red-600/10 text-red-600/70">
              {underperformers.length}
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-red-600/30" />
          </div>
          <div className="space-y-3">
            {underperformers.map((team, idx) => (
              <div key={`${team.name}-${team.league}`}>
                {renderTeamCard(team, idx + 1, "under", idx)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type ViewMode = "cards" | "bars";

const CARDS_ICON = (
  <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <rect x="1" y="1" width="6" height="6" rx="1.5" />
    <rect x="9" y="1" width="6" height="6" rx="1.5" />
    <rect x="1" y="9" width="6" height="6" rx="1.5" />
    <rect x="9" y="9" width="6" height="6" rx="1.5" />
  </svg>
);

const RANKED_ICON = (
  <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <rect x="1" y="2" width="14" height="3" rx="1.5" />
    <rect x="1" y="6.5" width="10" height="3" rx="1.5" />
    <rect x="1" y="11" width="6" height="3" rx="1.5" />
  </svg>
);

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <ToggleGroup
      type="single"
      value={view}
      onValueChange={(value) => value && onChange(value as ViewMode)}
      className="inline-flex gap-0.5 rounded-lg border border-border-subtle bg-card p-0.5"
    >
      <ToggleGroupItem
        value="cards"
        aria-label="Card view"
        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs sm:text-sm font-medium text-text-muted transition-colors hover:text-text-secondary active:scale-[0.97] data-[state=on]:bg-elevated data-[state=on]:text-accent-blue"
      >
        {CARDS_ICON}
        Cards
      </ToggleGroupItem>
      <ToggleGroupItem
        value="bars"
        aria-label="Ranked view"
        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs sm:text-sm font-medium text-text-muted transition-colors hover:text-text-secondary active:scale-[0.97] data-[state=on]:bg-elevated data-[state=on]:text-accent-blue"
      >
        {RANKED_ICON}
        Ranked
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

export function TeamFormUI({ initialData, formLeaders }: TeamFormUIProps) {
  const data = initialData;
  const { params, update } = useQueryParams("/expected-position");
  const [view, setView] = useState<ViewMode>("bars");
  const requestedLeague = params.get("league");
  const selectedLeague =
    requestedLeague && LEAGUES.some((league) => league.name === requestedLeague)
      ? requestedLeague
      : "all";

  const { overperformers: filteredOverperformers, underperformers: filteredUnderperformers } =
    useMemo(() => {
      const teams =
        selectedLeague === "all"
          ? data.allTeams
          : data.allTeams.filter((t) => t.league === selectedLeague);
      return splitPerformers(teams, selectedLeague === "all" ? 20 : undefined);
    }, [data.allTeams, selectedLeague]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <LeagueFilter
          selectedLeague={selectedLeague}
          onValueChange={(value) => update({ league: value === "all" ? null : value })}
        />
        <div className="mb-4 sm:mb-6">
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {view === "cards" ? (
        <TeamListsGrid
          overperformers={filteredOverperformers}
          underperformers={filteredUnderperformers}
          formLeaders={formLeaders}
        />
      ) : (
        <TeamGapBars
          overperformers={filteredOverperformers}
          underperformers={filteredUnderperformers}
          formLeaders={formLeaders}
        />
      )}
    </>
  );
}
