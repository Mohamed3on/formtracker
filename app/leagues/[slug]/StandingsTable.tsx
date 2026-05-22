"use client";

import { type ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FormLeaderPill } from "@/components/FormLeaderPill";
import { cn } from "@/lib/utils";
import { formatMarketValue, getTeamDetailHref, ordinal } from "@/lib/format";
import type { TeamFormEntry } from "@/app/types";

type SortKey = "position" | "marketValue" | "delta";
type Dir = "asc" | "desc";

export interface FormLeader {
  type: "top" | "bottom";
  count: number;
}

const NATURAL_DIR: Record<SortKey, Dir> = {
  position: "asc",
  marketValue: "desc",
  delta: "desc",
};

export function StandingsTable({
  teams,
  formLeaders,
}: {
  teams: TeamFormEntry[];
  formLeaders?: Record<string, FormLeader>;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: Dir }>({
    key: "position",
    dir: "asc",
  });

  const sorted = useMemo(() => {
    const list = [...teams];
    list.sort((a, b) => {
      let diff: number;
      switch (sort.key) {
        case "marketValue":
          diff = a.marketValueNum - b.marketValueNum;
          break;
        case "delta":
          diff = a.deltaPts - b.deltaPts;
          break;
        default:
          diff = a.leaguePosition - b.leaguePosition;
      }
      return sort.dir === "asc" ? diff : -diff;
    });
    return list;
  }, [teams, sort]);

  const toggle = (key: SortKey) => {
    setSort((cur) =>
      cur.key === key
        ? { key, dir: cur.dir === "asc" ? "desc" : "asc" }
        : { key, dir: NATURAL_DIR[key] },
    );
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortHeader
            label="#"
            active={sort.key === "position"}
            dir={sort.dir}
            onClick={() => toggle("position")}
            className="w-8"
          />
          <TableHead className="text-left">Team</TableHead>
          <TableHead className="text-right">Pts</TableHead>
          <SortHeader
            label={
              <>
                <span className="sm:hidden">Value</span>
                <span className="hidden sm:inline">Market value</span>
              </>
            }
            active={sort.key === "marketValue"}
            dir={sort.dir}
            onClick={() => toggle("marketValue")}
            align="right"
          />
          <SortHeader
            label="Δ"
            active={sort.key === "delta"}
            dir={sort.dir}
            onClick={() => toggle("delta")}
            align="right"
            className="w-10 sm:w-16"
          />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((team) => (
          <StandingsRow key={team.clubId} team={team} formLeader={formLeaders?.[team.clubId]} />
        ))}
      </TableBody>
    </Table>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = "left",
  className,
}: {
  label: ReactNode;
  active: boolean;
  dir: Dir;
  onClick: () => void;
  align?: "left" | "right";
  className?: string;
}) {
  const Arrow = dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={cn(align === "right" ? "text-right" : "text-left", className)}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-text-primary cursor-pointer",
          align === "right" && "ml-auto",
          active ? "text-text-primary" : "text-text-muted",
        )}
      >
        {label}
        {active && <Arrow className="h-3 w-3" />}
      </button>
    </TableHead>
  );
}

function StandingsRow({ team, formLeader }: { team: TeamFormEntry; formLeader?: FormLeader }) {
  const tint =
    team.deltaPts > 0
      ? "bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08]"
      : team.deltaPts < 0
        ? "bg-red-500/[0.04] hover:bg-red-500/[0.08]"
        : "hover:bg-card-hover";
  const deltaColor =
    team.deltaPts > 0 ? "text-emerald-400" : team.deltaPts < 0 ? "text-red-400" : "text-text-muted";

  return (
    <TableRow className={cn("transition-colors", tint)}>
      <TableCell className="text-left font-value text-text-secondary">
        {team.leaguePosition}
      </TableCell>
      <TableCell className="w-full max-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-white p-0.5">
            {team.logoUrl ? (
              <img src={team.logoUrl} alt="" className="h-full w-full object-contain" />
            ) : null}
          </div>
          <Link
            href={getTeamDetailHref(team.clubId)}
            className="truncate font-medium text-text-primary hover:underline"
          >
            {team.name}
          </Link>
          {formLeader && <FormLeaderPill type={formLeader.type} compact />}
        </div>
      </TableCell>
      <TableCell className="text-right font-value text-text-primary">{team.points}</TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <span className="font-value text-text-primary">
          {formatMarketValue(team.marketValueNum)}
        </span>
        <span className="ml-1.5 hidden text-xs text-text-muted sm:inline">
          {ordinal(team.marketValueRank)}
        </span>
      </TableCell>
      <TableCell className={cn("text-right font-value whitespace-nowrap", deltaColor)}>
        {team.deltaPts > 0 ? "+" : ""}
        {team.deltaPts}
      </TableCell>
    </TableRow>
  );
}
