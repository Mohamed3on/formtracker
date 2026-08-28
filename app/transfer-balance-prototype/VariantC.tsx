"use client";

// PROTOTYPE Variant C — "Ladder spine": the search itself is the page. Each rung of the
// 1/2/4/8 ladder is a row showing its four #1s and whether anyone took two of them.
// No separate window toggle — expanding a rung IS the navigation.
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { METRICS, money, net, netTone, Crest, type MetricKey, type Window } from "./shared";

export function VariantC({ windows }: { windows: Window[] }) {
  const firstResolved = windows.find((w) => w.winners.length > 0)?.seasons ?? windows[0].seasons;
  const [open, setOpen] = useState<number | null>(firstResolved);

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--text-muted)]">
        Widening the window one rung at a time until a club holds at least{" "}
        <span className="font-value">2</span> of the <span className="font-value">4</span> top
        spots.
      </p>

      {windows.map((w, i) => {
        const resolved = w.winners.length > 0;
        const isOpen = open === w.seasons;
        return (
          <Card
            key={w.seasons}
            className={resolved ? "border-[var(--accent-gold)]" : "border-[var(--border-subtle)]"}
          >
            <CardContent className="p-0">
              <button
                onClick={() => setOpen(isOpen ? null : w.seasons)}
                className="flex w-full flex-col gap-3 p-4 text-left hover:bg-[var(--bg-card-hover)] sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="flex items-center gap-3 sm:w-48 sm:shrink-0">
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs ${
                      resolved
                        ? "bg-[var(--accent-gold)] text-black"
                        : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                    }`}
                  >
                    <span className="font-value font-bold">{i + 1}</span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold">
                      <span className="font-value">{w.seasons}</span>{" "}
                      {w.seasons === 1 ? "season" : "seasons"}
                    </p>
                    <p className="font-value text-xs text-[var(--text-muted)]">{w.label}</p>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  {resolved ? (
                    <p className="text-sm">
                      <span className="font-bold">{w.winners[0].name}</span>
                      <span className="text-[var(--text-muted)]">
                        {" "}
                        takes {w.winners[0].metrics.map((m) => METRICS[m]).join(" + ")}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">
                      Four different leaders — no club takes two.
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {(Object.keys(METRICS) as MetricKey[]).map((k) => (
                      <span key={k} className="text-xs text-[var(--text-muted)]">
                        {METRICS[k]}:{" "}
                        <span className="text-[var(--text-secondary)]">{w.leaders[k].name}</span>
                      </span>
                    ))}
                  </div>
                </div>

                <span className="text-[var(--text-muted)] sm:shrink-0">{isOpen ? "▲" : "▼"}</span>
              </button>

              {isOpen && (
                <div className="overflow-x-auto border-t border-[var(--border-subtle)]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Club</TableHead>
                        <TableHead className="text-right">Gross spend</TableHead>
                        <TableHead className="text-right">Signings</TableHead>
                        <TableHead className="text-right">Sales</TableHead>
                        <TableHead className="text-right">Departures</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {w.clubs.slice(0, 15).map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Crest club={c} />
                              <span className="text-sm font-bold">{c.name}</span>
                              {(w.wins[c.id] ?? []).length >= 2 && (
                                <span className="text-[var(--accent-gold)]">★</span>
                              )}
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
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
