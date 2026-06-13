"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Coins, TrendingUp } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { fmt } from "@/lib/wc/model";
import type { MatchupExtremes, MatchupRow, MatchupTeam } from "@/lib/wc/matchups";

type Mode = "date" | "value";

// Pre-paint on the client (smooth FLIP), plain effect on the server (no warning).
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function WcGroupStage({ data }: { data: MatchupExtremes }) {
  const [mode, setMode] = useState<Mode>("date");
  const rootRef = useRef<HTMLDivElement>(null);
  const prevTops = useRef(new Map<string, number>());

  // FLIP: animate each card from its previous position whenever the order changes.
  useIsoLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.querySelectorAll<HTMLElement>("[data-mid]").forEach((el) => {
      const id = el.dataset.mid as string;
      const top = el.getBoundingClientRect().top;
      const prev = prevTops.current.get(id);
      if (!reduce && prev != null && Math.abs(prev - top) > 1)
        el.animate([{ transform: `translateY(${prev - top}px)` }, { transform: "translateY(0)" }], {
          duration: 320,
          easing: "cubic-bezier(.2,.7,.2,1)",
        });
      prevTops.current.set(id, top);
    });
  });

  const order = (items: MatchupRow[], dir: "asc" | "desc") =>
    [...items].sort((a, b) =>
      mode === "value" ? (dir === "asc" ? a.sum - b.sum : b.sum - a.sum) : a.kickoff - b.kickoff,
    );

  const sections = [
    {
      kind: "most" as const,
      title: "Most valuable",
      Icon: TrendingUp,
      items: data.most,
      dir: "desc" as const,
    },
    {
      kind: "least" as const,
      title: "Least valuable",
      Icon: Coins,
      items: data.least,
      dir: "asc" as const,
    },
  ];

  return (
    <div ref={rootRef} className="mx-auto max-w-3xl px-4">
      <header>
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-400">
          FIFA World Cup 2026 · Group Stage
        </div>
        <h1 className="font-pixel mt-2 text-3xl font-bold tracking-tight">
          Matchup value extremes
        </h1>
        <p className="mt-2 max-w-prose text-sm text-text-secondary">
          The 10 most and 10 least valuable group games by combined squad market value (live).{" "}
          <b>MD</b> = matchday; an <b className="text-amber-400">MD3</b> game is flagged a{" "}
          <b className="text-rose-300">dead rubber</b> once both teams have secured top-2 (the
          result can&apos;t change who qualifies). Scores fill in as matches are played. Kickoffs in{" "}
          <b>CEST (UTC+2)</b>.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs uppercase tracking-wider text-text-muted">Sort</span>
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(v) => v && setMode(v as Mode)}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="date">Date</ToggleGroupItem>
            <ToggleGroupItem value="value">Value</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </header>

      {sections.map(({ kind, title, Icon, items, dir }) => {
        const max = Math.max(1, ...items.map((i) => i.sum));
        const cheap = kind === "least";
        return (
          <section key={kind} className="mt-8">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">
              <Icon className={clsx("size-4", cheap ? "text-sky-400" : "text-amber-400")} />
              {title}
            </h2>
            <div className="mt-3 flex flex-col gap-2.5">
              {order(items, dir).map((row) => (
                <MatchCard key={row.id} row={row} max={max} cheap={cheap} />
              ))}
            </div>
          </section>
        );
      })}

      <footer className="mt-8 text-center text-xs text-text-muted">
        Combined squad market value · data from Transfermarkt · refreshed hourly
      </footer>
    </div>
  );
}

function TeamName({ t, win }: { t: MatchupTeam; win: boolean }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-2 text-[15px]",
        win ? "font-bold text-text-primary" : "font-semibold text-text-secondary",
      )}
    >
      <span className="text-xl leading-none">{t.flag}</span>
      {t.short}
    </span>
  );
}

function MatchCard({ row, max, cheap }: { row: MatchupRow; max: number; cheap: boolean }) {
  const md = row.matchday;
  const badge =
    md !== 3
      ? { text: `MD${md}`, cls: "border-border-subtle text-text-muted", title: undefined }
      : row.deadRubber === true
        ? {
            text: "MD3 · dead rubber",
            cls: "border-rose-500/40 bg-rose-500/10 font-medium text-rose-300",
            title: "Both teams have already secured top-2 — the result can't change who qualifies",
          }
        : row.deadRubber === false
          ? {
              text: "MD3",
              cls: "border-border-subtle text-text-muted",
              title: "Final matchday — still has stakes",
            }
          : {
              text: "MD3 · dead rubber?",
              cls: "border-amber-500/40 bg-amber-500/10 font-medium text-amber-400",
              title: "Final matchday — could be a dead rubber once matchday 2 is played",
            };
  const accent = cheap ? "text-sky-400" : "text-amber-400";
  const winner =
    row.played && row.hs !== row.as ? ((row.hs ?? 0) > (row.as ?? 0) ? "home" : "away") : null;

  return (
    <div
      data-mid={row.id}
      className="grid grid-cols-1 items-center gap-3 rounded-xl border border-border-subtle bg-elevated px-4 py-3 transition-[transform,border-color] duration-150 will-change-transform hover:-translate-y-0.5 hover:border-text-muted/50 sm:grid-cols-[5rem_1fr_auto] sm:gap-4"
    >
      <div className="flex items-baseline gap-2 sm:flex-col sm:items-start sm:gap-0 sm:border-r sm:border-border-subtle sm:pr-3">
        <span className="text-[11px] uppercase tracking-wide text-text-muted">{row.dow}</span>
        <span className="text-base font-bold">{row.dayLabel}</span>
        <span className={clsx("font-value text-xs", row.played ? "text-text-muted" : accent)}>
          {row.played ? "FT" : row.timeLabel}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <TeamName t={row.home} win={winner === "home"} />
        {row.played ? (
          <span className="font-value px-1 text-base">
            {row.hs}
            <span className="px-0.5 text-text-muted">–</span>
            {row.as}
          </span>
        ) : (
          <span className="px-1 text-xs italic text-text-muted">v</span>
        )}
        <TeamName t={row.away} win={winner === "away"} />
        <Badge variant="outline" className="text-text-muted">
          Group {row.group}
        </Badge>
        <span
          title={badge.title}
          className={clsx("rounded-full border px-2 py-0.5 text-[11px]", badge.cls)}
        >
          {badge.text}
        </span>
      </div>

      <div className="flex flex-col items-start gap-0.5 sm:items-end">
        <span className={clsx("font-value text-xl", accent)}>{fmt(row.sum)}</span>
        <span className="text-[11px] text-text-muted">
          #{row.vrank} {cheap ? "least" : "most"} valuable
        </span>
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-border-subtle sm:w-32">
          <div
            className={clsx(
              "h-full rounded-full",
              cheap
                ? "bg-gradient-to-r from-sky-700 to-sky-400"
                : "bg-gradient-to-r from-amber-600 to-amber-400",
            )}
            style={{ width: `${((row.sum / max) * 100).toFixed(1)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
