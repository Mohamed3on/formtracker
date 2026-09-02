"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SelectNative } from "@/components/ui/select-native";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TONE_TEXT, gainTone } from "@/lib/fee-vs-value-rankings";
import { formatMillions, getTeamDetailHref } from "@/lib/format";
import { crestUrl } from "@/lib/transfermarkt/image";
import { cn } from "@/lib/utils";
import type { TransferBalanceClub, TransferBalanceWindow } from "@/app/types";

type SortKey = "name" | "expenditure" | "arrivals" | "income" | "departures" | "balance";

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "name", label: "Club", numeric: false },
  { key: "expenditure", label: "Gross spend", numeric: true },
  { key: "arrivals", label: "Signings", numeric: true },
  { key: "income", label: "Sales", numeric: true },
  { key: "departures", label: "Departures", numeric: true },
  { key: "balance", label: "Net", numeric: true },
];

/** Down on transfers is red, up is green — the site's one colour rule, read
 *  off the balance's sign: positive means the club banked money. */
const netTone = (value: number) => TONE_TEXT[gainTone(value)];

function ClubCell({ club, multi }: { club: TransferBalanceClub; multi: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={crestUrl(club.id)}
        alt=""
        loading="lazy"
        className="size-5 shrink-0 object-contain"
      />
      <Link
        href={getTeamDetailHref(club.id)}
        className="truncate text-sm font-bold hover:underline"
      >
        {club.name}
      </Link>
      {multi && <Badge className="shrink-0">★</Badge>}
    </div>
  );
}

/**
 * Every deal Transfermarkt lists, in cash, for the world's biggest buyers and
 * sellers — one window of it, chosen by the seasons control up in the overview.
 *
 * The table needs 604px and only fits from md up; below that it hid the Net
 * column entirely behind a horizontal scroll, so phones get cards instead.
 */
export function BalanceTable({ window }: { window: TransferBalanceWindow }) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "expenditure",
    desc: true,
  });

  const rows = useMemo(() => {
    const sorted = [...window.clubs].sort((a, b) =>
      sort.key === "name" ? a.name.localeCompare(b.name) : a[sort.key] - b[sort.key],
    );
    return sort.desc ? sorted.reverse() : sorted;
  }, [window, sort]);

  // Header clicks flip direction on the active column; the mobile select only
  // ever picks a column, so it takes that column's natural direction instead.
  const toggleSort = (key: SortKey, fromSelect = false) =>
    setSort((s) =>
      s.key === key && !fromSelect ? { key, desc: !s.desc } : { key, desc: key !== "name" },
    );
  const isMulti = (id: string) => (window.wins[id] ?? []).length >= 2;

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">
        <span className="font-value">{window.label}</span> ·{" "}
        <span className="font-value">{window.clubs.length}</span> clubs
      </p>

      <div className="space-y-3 md:hidden">
        <div className="flex items-center gap-2">
          <SelectNative
            aria-label="Sort clubs by"
            value={sort.key}
            onChange={(e) => toggleSort(e.target.value as SortKey, true)}
          >
            {COLUMNS.map((col) => (
              <option key={col.key} value={col.key}>
                Sort by {col.label.toLowerCase()}
              </option>
            ))}
          </SelectNative>
          <Button
            variant="outline"
            size="sm"
            className="h-10 shrink-0 px-3"
            aria-label={sort.desc ? "Sort ascending" : "Sort descending"}
            onClick={() => setSort((s) => ({ ...s, desc: !s.desc }))}
          >
            <span aria-hidden="true">{sort.desc ? "▼" : "▲"}</span>
          </Button>
        </div>

        {rows.map((club) => (
          <Card key={club.id} className={isMulti(club.id) ? "border-accent-gold" : ""}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-3">
                <ClubCell club={club} multi={isMulti(club.id)} />
                <div className="shrink-0 text-right">
                  <p className="text-xs tracking-wide text-text-muted uppercase">Net</p>
                  <p className={cn("font-value text-sm", netTone(club.balance))}>
                    {formatMillions(club.balance)}
                  </p>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border-subtle pt-2 text-xs">
                <div>
                  <dt className="text-text-muted">Gross spend</dt>
                  <dd className="font-value">
                    {formatMillions(club.expenditure)}{" "}
                    <span className="text-text-muted">({club.arrivals} in)</span>
                  </dd>
                </div>
                <div className="text-right">
                  <dt className="text-text-muted">Sales</dt>
                  <dd className="font-value">
                    {formatMillions(club.income)}{" "}
                    <span className="text-text-muted">({club.departures} out)</span>
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((col) => (
                <TableHead key={col.key} className={col.numeric ? "text-right" : ""}>
                  <button
                    onClick={() => toggleSort(col.key)}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1 hover:text-text-primary",
                      sort.key === col.key && "text-text-primary",
                    )}
                  >
                    {col.label}
                    <span className="text-xs opacity-60">
                      {sort.key === col.key ? (sort.desc ? "▼" : "▲") : "↕"}
                    </span>
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((club) => (
              <TableRow key={club.id} className={isMulti(club.id) ? "bg-accent-gold/10" : ""}>
                <TableCell>
                  <ClubCell club={club} multi={isMulti(club.id)} />
                </TableCell>
                <TableCell className="font-value text-right">
                  {formatMillions(club.expenditure)}
                </TableCell>
                <TableCell className="font-value text-right">{club.arrivals}</TableCell>
                <TableCell className="font-value text-right">
                  {formatMillions(club.income)}
                </TableCell>
                <TableCell className="font-value text-right">{club.departures}</TableCell>
                <TableCell className={cn("font-value text-right", netTone(club.balance))}>
                  {formatMillions(club.balance)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
