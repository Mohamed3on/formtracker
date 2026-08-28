"use client";

// PROTOTYPE Variant B — "Dense ledger": no hero at all. One sortable table, magnitude bars
// in every numeric cell, ★ on clubs holding >=2 of the four #1 slots. Scan-first.
import { useMemo, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { money, net, netTone, Crest, type Club, type Window } from "./shared";

type SortKey = "expenditure" | "income" | "netProfit" | "netSpender";

const COLUMNS: { key: SortKey; label: string; get: (c: Club) => number }[] = [
  { key: "expenditure", label: "Gross spend", get: (c) => c.expenditure },
  { key: "income", label: "Sales", get: (c) => c.income },
  { key: "netSpender", label: "Net", get: (c) => -net(c) },
];

function Bar({ value, max, tone }: { value: number; max: number; tone: string }) {
  const pct = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;
  return (
    <div className="mt-1 h-1 w-full rounded-full bg-[var(--border-subtle)]">
      <div
        className={`h-1 w-[var(--bar)] rounded-full ${tone}`}
        style={{ "--bar": `${pct}%` } as React.CSSProperties}
      />
    </div>
  );
}

export function VariantB({ windows }: { windows: Window[] }) {
  const [seasons, setSeasons] = useState(windows[0].seasons);
  const [sort, setSort] = useState<SortKey>("expenditure");
  const w = windows.find((x) => x.seasons === seasons)!;

  const rows = useMemo(() => {
    const s = [...w.clubs];
    if (sort === "netProfit") return s.sort((a, b) => net(b) - net(a));
    const col = COLUMNS.find((c) => c.key === sort)!;
    return s.sort((a, b) => col.get(b) - col.get(a));
  }, [w, sort]);

  const maxExp = Math.max(...w.clubs.map((c) => c.expenditure));
  const maxInc = Math.max(...w.clubs.map((c) => c.income));
  const maxNet = Math.max(...w.clubs.map((c) => Math.abs(net(c))));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ToggleGroup type="single" value={String(seasons)} onValueChange={(v) => v && setSeasons(Number(v))}>
          {windows.map((x) => (
            <ToggleGroupItem key={x.seasons} value={String(x.seasons)}>
              <span className="font-value">{x.seasons}y</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ToggleGroup type="single" value={sort} onValueChange={(v) => v && setSort(v as SortKey)}>
          {COLUMNS.map((c) => (
            <ToggleGroupItem key={c.key} value={c.key} className="text-xs">
              {c.label}
            </ToggleGroupItem>
          ))}
          <ToggleGroupItem value="netProfit" className="text-xs">
            Biggest sellers
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
        {rows.map((c, i) => {
          const wins = w.wins[c.id] ?? [];
          return (
            <div
              key={c.id}
              className={`grid grid-cols-[2rem_1fr] gap-x-3 py-2 sm:grid-cols-[2rem_minmax(0,1fr)_repeat(3,minmax(0,7rem))] sm:items-center ${
                wins.length >= 2 ? "bg-[var(--accent-gold)]/10" : ""
              }`}
            >
              <span className="font-value text-xs text-[var(--text-muted)]">{i + 1}</span>
              <div className="flex min-w-0 items-center gap-2">
                <Crest club={c} />
                <span className="truncate text-sm font-bold">{c.name}</span>
                {wins.length >= 2 && <span className="text-[var(--accent-gold)]">★</span>}
              </div>
              <div className="col-start-2 sm:col-start-3">
                <div className="flex justify-between gap-2 sm:block sm:text-right">
                  <span className="text-xs text-[var(--text-muted)] sm:hidden">Gross spend</span>
                  <span className="font-value text-sm">{money(c.expenditure)}</span>
                </div>
                <Bar value={c.expenditure} max={maxExp} tone="bg-[var(--accent-cold)]" />
              </div>
              <div className="col-start-2 sm:col-start-4">
                <div className="flex justify-between gap-2 sm:block sm:text-right">
                  <span className="text-xs text-[var(--text-muted)] sm:hidden">Sales</span>
                  <span className="font-value text-sm">{money(c.income)}</span>
                </div>
                <Bar value={c.income} max={maxInc} tone="bg-[var(--accent-green)]" />
              </div>
              <div className="col-start-2 sm:col-start-5">
                <div className="flex justify-between gap-2 sm:block sm:text-right">
                  <span className="text-xs text-[var(--text-muted)] sm:hidden">Net</span>
                  <span className={`font-value text-sm ${netTone(net(c))}`}>{money(net(c))}</span>
                </div>
                <Bar
                  value={net(c)}
                  max={maxNet}
                  tone={net(c) < 0 ? "bg-[var(--accent-cold)]" : "bg-[var(--accent-green)]"}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
