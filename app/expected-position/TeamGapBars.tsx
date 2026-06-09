"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ManagerInfo, TeamFormEntry } from "@/app/types";
import { ManagerSection, ManagerSkeleton } from "@/app/components/ManagerPPGBadge";
import { FormLeaderPill } from "@/components/FormLeaderPill";
import { LeagueBadge } from "@/components/LeagueBadge";
import { formatValueStr, getTeamDetailHref, ordinal } from "@/lib/format";
import { useManagersMap } from "@/lib/hooks/use-manager-query";

interface GapBarRowProps {
  team: TeamFormEntry;
  formLeader?: { type: "top" | "bottom"; count: number };
  manager?: ManagerInfo | null;
  managerLoading?: boolean;
}

function GapBarRow({ team, formLeader, manager, managerLoading }: GapBarRowProps) {
  const over = team.deltaPts >= 0;
  const valueStr = formatValueStr(team.marketValue);

  return (
    <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 hover:bg-card-hover transition-colors">
      {/* Points gap — pixel scoreboard, the hero of the row */}
      <div
        className={`w-12 sm:w-14 shrink-0 text-right font-pixel text-2xl sm:text-3xl leading-none ${over ? "text-green-500" : "text-red-500"}`}
      >
        {over ? "+" : "−"}
        {Math.abs(team.deltaPts)}
      </div>

      {/* Club logo */}
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center p-1 bg-white shadow-sm">
        {team.logoUrl ? (
          <img src={team.logoUrl} alt={team.name} className="w-full h-full object-contain" />
        ) : (
          <div className="text-text-muted">?</div>
        )}
      </div>

      {/* Team, manager, value context */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <Link
            href={getTeamDetailHref(team.clubId)}
            className="truncate font-semibold text-sm sm:text-base text-text-primary hover:underline"
          >
            {team.name}
          </Link>
          <LeagueBadge league={team.league} />
          {formLeader && <FormLeaderPill type={formLeader.type} />}
        </div>

        {managerLoading ? (
          <div className="text-[11px] sm:text-sm">
            <ManagerSkeleton />
          </div>
        ) : (
          manager && (
            <div className="text-[11px] sm:text-sm text-text-muted animate-fade-in">
              <ManagerSection manager={manager} />
            </div>
          )
        )}

        <div className="truncate text-[11px] sm:text-xs text-text-muted">
          <span className="font-value">{ordinal(team.leaguePosition)}</span> now,{" "}
          <span className="font-value">{ordinal(team.marketValueRank)}</span> by squad value
          {valueStr !== "-" && <span className="text-text-muted/60"> · {valueStr}</span>}
        </div>
      </div>
    </div>
  );
}

function PerformerColumn({
  teams,
  type,
  formLeaders,
  managersMap,
  loadingSet,
}: {
  teams: TeamFormEntry[];
  type: "over" | "under";
  formLeaders?: Record<string, { type: "top" | "bottom"; count: number }>;
  managersMap: Record<string, ManagerInfo | null>;
  loadingSet: Set<string>;
}) {
  const over = type === "over";
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h2
          className={`text-lg sm:text-xl font-pixel flex items-center gap-2 shrink-0 ${over ? "text-green-600" : "text-red-600"}`}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            {over ? (
              <path
                fillRule="evenodd"
                d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            ) : (
              <path
                fillRule="evenodd"
                d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            )}
          </svg>
          {over ? "Overperformers" : "Underperformers"}
        </h2>
        <span
          className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${over ? "bg-green-600/10 text-green-600/70" : "bg-red-600/10 text-red-600/70"}`}
        >
          {teams.length}
        </span>
        <div
          className={`flex-1 h-px bg-gradient-to-r ${over ? "from-green-600/30" : "from-red-600/30"}`}
        />
      </div>

      <div className="rounded-xl border border-border-subtle bg-card divide-y divide-border-subtle overflow-hidden">
        {teams.map((team) => (
          <GapBarRow
            key={`${team.clubId}-${team.league}`}
            team={team}
            formLeader={formLeaders?.[team.clubId]}
            manager={managersMap[team.clubId]}
            managerLoading={loadingSet.has(team.clubId)}
          />
        ))}
      </div>
    </div>
  );
}

export function TeamGapBars({
  overperformers,
  underperformers,
  formLeaders,
}: {
  overperformers: TeamFormEntry[];
  underperformers: TeamFormEntry[];
  formLeaders?: Record<string, { type: "top" | "bottom"; count: number }>;
}) {
  const allTeams = useMemo(
    () => [...overperformers, ...underperformers],
    [overperformers, underperformers],
  );
  const clubIds = useMemo(
    () => [...new Set(allTeams.map((t) => t.clubId).filter(Boolean))],
    [allTeams],
  );
  const { managersMap, loadingSet } = useManagersMap(clubIds);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start animate-fade-in">
      <PerformerColumn
        teams={overperformers}
        type="over"
        formLeaders={formLeaders}
        managersMap={managersMap}
        loadingSet={loadingSet}
      />
      <PerformerColumn
        teams={underperformers}
        type="under"
        formLeaders={formLeaders}
        managersMap={managersMap}
        loadingSet={loadingSet}
      />
    </div>
  );
}
