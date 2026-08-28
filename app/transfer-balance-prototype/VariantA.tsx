"use client";

// PROTOTYPE Variant A — "Leaders first": the four #1 slots are the hero, sortable table below.
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { METRICS, money, net, netTone, Crest, type Club, type MetricKey, type Window } from "./shared";

type SortKey = "name" | "expenditure" | "arrivals" | "income" | "departures" | "net";

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "name", label: "Club", numeric: false },
  { key: "expenditure", label: "Gross spend", numeric: true },
  { key: "arrivals", label: "Signings", numeric: true },
  { key: "income", label: "Sales", numeric: true },
  { key: "departures", label: "Departures", numeric: true },
  { key: "net", label: "Net", numeric: true },
];

export function VariantA({ windows }: { windows: Window[] }) {
  const [seasons, setSeasons] = useState(windows[0].seasons);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "expenditure",
    desc: true,
  });
  const w = windows.find((x) => x.seasons === seasons)!;

  const rows = useMemo(() => {
    const sorted = [...w.clubs].sort((a, b) => {
      if (sort.key === "name") return a.name.localeCompare(b.name);
      if (sort.key === "net") return net(a) - net(b);
      return (a[sort.key] as number) - (b[sort.key] as number);
    });
    return sort.desc ? sorted.reverse() : sorted;
  }, [w, sort]);

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
        {windows.map((x) => (
          <ToggleGroupItem key={x.seasons} value={String(x.seasons)} className="flex-1 sm:flex-none">
            <span className="font-value">{x.seasons}</span>
            <span className="ml-1 text-xs text-[var(--text-muted)]">
              {x.seasons === 1 ? "season" : "seasons"}
            </span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <p className="text-sm text-[var(--text-muted)]">
        Window: <span className="font-value">{w.label}</span> ·{" "}
        <span className="font-value">{w.clubs.length}</span> clubs
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(Object.keys(METRICS) as MetricKey[]).map((key) => {
          const leader = w.leaders[key];
          const multi = (w.wins[leader.id] ?? []).length >= 2;
          return (
            <Card key={key} className={multi ? "border-[var(--accent-gold)]" : ""}>
              <CardContent className="p-3 sm:p-4">
                <p className="mb-2 text-xs tracking-wide text-[var(--text-muted)] uppercase">
                  {METRICS[key]}
                </p>
                <div className="mb-1 flex items-center gap-2">
                  <Crest club={w.clubs.find((c) => c.id === leader.id)!} />
                  <span className="truncate text-sm font-bold">{leader.name}</span>
                </div>
                <p
                  className={`font-value text-lg ${
                    key === "netSpender" || key === "netProfit" ? netTone(leader.value) : ""
                  }`}
                >
                  {money(leader.value)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {w.winners.length > 0 ? (
        <Card className="border-[var(--accent-gold)] bg-[var(--accent-gold)]/5">
          <CardContent className="p-4">
            {w.winners.map((win) => (
              <p key={win.id} className="text-sm">
                <span className="font-bold">{win.name}</span> tops{" "}
                <span className="font-value">{win.metrics.length}</span> of{" "}
                <span className="font-value">4</span> —{" "}
                {win.metrics.map((m) => METRICS[m]).join(" + ")}
              </p>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4 text-sm text-[var(--text-muted)]">
            No club tops two of the four in this window — all four leaders are different clubs.
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
                    className={`inline-flex items-center gap-1 hover:text-[var(--text-primary)] ${
                      sort.key === col.key ? "text-[var(--text-primary)]" : ""
                    }`}
                  >
                    {col.label}
                    <span className="text-[0.625rem] opacity-60">
                      {sort.key === col.key ? (sort.desc ? "▼" : "▲") : "↕"}
                    </span>
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c: Club) => (
              <TableRow
                key={c.id}
                className={(w.wins[c.id] ?? []).length >= 2 ? "bg-[var(--accent-gold)]/10" : ""}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Crest club={c} />
                    <span className="text-sm font-bold">{c.name}</span>
                    {(w.wins[c.id] ?? []).length >= 2 && <Badge>★</Badge>}
                  </div>
                </TableCell>
                <TableCell className="font-value text-right">{money(c.expenditure)}</TableCell>
                <TableCell className="font-value text-right">{c.arrivals}</TableCell>
                <TableCell className="font-value text-right">{money(c.income)}</TableCell>
                <TableCell className="font-value text-right">{c.departures}</TableCell>
                <TableCell className={`font-value text-right ${netTone(net(c))}`}>
                  {money(net(c))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
