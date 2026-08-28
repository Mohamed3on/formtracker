"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMarketValue, getTeamDetailHref } from "@/lib/format";
import { crestUrl } from "@/lib/transfermarkt";
import type {
  TransferBalanceClub,
  TransferBalanceMetric,
  TransferBalanceResult,
  TransferBalanceWindow,
} from "@/app/types";

/** Football terms, not accountancy. The Net column reads like a bank balance:
 *  positive = the club banked money on transfers, negative = it spent money. A
 *  club's "net spend" is therefore the negative of its Net figure. */
const METRICS: Record<TransferBalanceMetric, string> = {
  expenditure: "Gross spend",
  income: "Sales",
  netSpender: "Biggest net spender",
  netProfit: "Biggest net profit",
};

const METRIC_ORDER: TransferBalanceMetric[] = ["expenditure", "income", "netSpender", "netProfit"];

type SortKey = "name" | "expenditure" | "arrivals" | "income" | "departures" | "balance";

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "name", label: "Club", numeric: false },
  { key: "expenditure", label: "Gross spend", numeric: true },
  { key: "arrivals", label: "Signings", numeric: true },
  { key: "income", label: "Sales", numeric: true },
  { key: "departures", label: "Departures", numeric: true },
  { key: "balance", label: "Net", numeric: true },
];

/** Data is in millions; the shared formatter takes raw euros. */
const fee = (millions: number) => formatMarketValue(millions * 1_000_000);

/** Down on transfers is red, up is green. NB --accent-hot is GREEN in this design
 *  system (#00ff87) — --accent-cold is the red. */
const netTone = (value: number) =>
  value < 0 ? "text-[var(--accent-cold)]" : "text-[var(--accent-green)]";

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

export function TransferBalanceUI({ data }: { data: TransferBalanceResult }) {
  const [seasons, setSeasons] = useState(data.windows[0].seasons);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "expenditure",
    desc: true,
  });

  const window: TransferBalanceWindow =
    data.windows.find((w) => w.seasons === seasons) ?? data.windows[0];

  const rows = useMemo(() => {
    const sorted = [...window.clubs].sort((a, b) =>
      sort.key === "name" ? a.name.localeCompare(b.name) : a[sort.key] - b[sort.key],
    );
    return sort.desc ? sorted.reverse() : sorted;
  }, [window, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== "name" }));

  return (
    <div className="space-y-6">
      <ToggleGroup
        type="single"
        value={String(seasons)}
        onValueChange={(v) => v && setSeasons(Number(v))}
        className="w-full sm:w-auto"
      >
        {data.windows.map((w) => (
          <ToggleGroupItem
            key={w.seasons}
            value={String(w.seasons)}
            className="flex-1 sm:flex-none"
          >
            <span className="font-value">{w.seasons}</span>
            <span className="ml-1 text-xs text-text-muted">
              {w.seasons === 1 ? "season" : "seasons"}
            </span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <p className="text-sm text-text-muted">
        <span className="font-value">{window.label}</span> ·{" "}
        <span className="font-value">{window.clubs.length}</span> clubs
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {METRIC_ORDER.map((metric) => {
          const leader = window.leaders[metric];
          const club = window.clubs.find((c) => c.id === leader.id);
          const multi = (window.wins[leader.id] ?? []).length >= 2;
          const signed = metric === "netSpender" || metric === "netProfit";
          return (
            <Card key={metric} className={multi ? "border-[var(--accent-gold)]" : ""}>
              <CardContent className="p-3 sm:p-4">
                <p className="mb-2 text-xs tracking-wide text-text-muted uppercase">
                  {METRICS[metric]}
                </p>
                <div className="mb-1 flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={crestUrl(leader.id)}
                    alt=""
                    loading="lazy"
                    className="size-5 shrink-0 object-contain"
                  />
                  <Link
                    href={getTeamDetailHref(leader.id)}
                    className="truncate text-sm font-bold hover:underline"
                  >
                    {club?.name ?? leader.name}
                  </Link>
                </div>
                <p className={`font-value text-lg ${signed ? netTone(leader.value) : ""}`}>
                  {fee(leader.value)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {window.winners.length > 0 ? (
        <Card className="border-[var(--accent-gold)] bg-[var(--accent-gold)]/5">
          <CardContent className="p-4">
            {window.winners.map((winner) => (
              <p key={winner.id} className="text-sm">
                <span className="font-bold">{winner.name}</span> tops{" "}
                <span className="font-value">{winner.metrics.length}</span> of{" "}
                <span className="font-value">4</span> —{" "}
                {winner.metrics.map((m) => METRICS[m]).join(" + ")}
              </p>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4 text-sm text-text-muted">
            No club tops two of the four over this window — all four leaders are different clubs.
            Widen the window to find one.
          </CardContent>
        </Card>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((col) => (
                <TableHead key={col.key} className={col.numeric ? "text-right" : ""}>
                  <button
                    onClick={() => toggleSort(col.key)}
                    className={`inline-flex items-center gap-1 hover:text-text-primary ${
                      sort.key === col.key ? "text-text-primary" : ""
                    }`}
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
            {rows.map((club) => {
              const multi = (window.wins[club.id] ?? []).length >= 2;
              return (
                <TableRow key={club.id} className={multi ? "bg-[var(--accent-gold)]/10" : ""}>
                  <TableCell>
                    <ClubCell club={club} multi={multi} />
                  </TableCell>
                  <TableCell className="font-value text-right">{fee(club.expenditure)}</TableCell>
                  <TableCell className="font-value text-right">{club.arrivals}</TableCell>
                  <TableCell className="font-value text-right">{fee(club.income)}</TableCell>
                  <TableCell className="font-value text-right">{club.departures}</TableCell>
                  <TableCell className={`font-value text-right ${netTone(club.balance)}`}>
                    {fee(club.balance)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
