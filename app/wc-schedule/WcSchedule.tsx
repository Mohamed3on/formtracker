"use client";

import { type Ref, useEffect, useLayoutEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { fmt } from "@/lib/wc/model";
import type { MatchupRow, MatchupTeam, Stage } from "@/lib/wc/matchups";

type Mode = "date" | "value";
type Status = "played" | "live" | "next" | "upcoming";

const ROUND_LABEL: Record<Exclude<Stage, "group">, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-final",
  SF: "Semi-final",
  F: "Final",
  "3RD": "3rd place",
};

// A match runs ~2h; past that, an unplayed fixture is treated as awaiting its result, not live.
const LIVE_WINDOW_MS = 150 * 60_000;

// Pre-paint on the client (smooth FLIP), plain effect on the server (no warning).
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// kickoff is YYYYMMDDHHMM in CEST (UTC+2) → epoch ms, to compare against the client clock.
function kickoffMs(k: number): number {
  const s = String(k);
  return Date.UTC(
    +s.slice(0, 4),
    +s.slice(4, 6) - 1,
    +s.slice(6, 8),
    +s.slice(8, 10) - 2,
    +s.slice(10, 12),
  );
}

export function WcSchedule({ rows }: { rows: MatchupRow[] }) {
  const [mode, setMode] = useState<Mode>("date");
  const [now, setNow] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const prevTops = useRef(new Map<string, number>());

  // FLIP: animate each card from its previous position whenever the order changes.
  useIsoLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.querySelectorAll<HTMLElement>("[data-mid]").forEach((el) => {
      const id = el.dataset.mid as string;
      // Document-relative so auto-scrolling the page never reads as a reorder.
      const top = el.getBoundingClientRect().top + window.scrollY;
      const prev = prevTops.current.get(id);
      if (!reduce && prev != null && Math.abs(prev - top) > 1)
        el.animate([{ transform: `translateY(${prev - top}px)` }, { transform: "translateY(0)" }], {
          duration: 320,
          easing: "cubic-bezier(.2,.7,.2,1)",
        });
      prevTops.current.set(id, top);
    });
  });

  // Client clock (data only refreshes hourly) so a fixture flips to "live" the moment it kicks off.
  useIsoLayoutEffect(() => setNow(Date.now()), []);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const max = Math.max(1, ...rows.map((r) => r.sum));
  const sorted = [...rows].sort((a, b) =>
    mode === "value" ? b.sum - a.sum : a.kickoff - b.kickoff,
  );

  // Sorted by date: focus the current or next match — the first not-yet-played fixture in
  // chronological order (live, so it advances through the day). Finished games stay scrollable above.
  const focusId = mode === "date" ? (sorted.find((r) => !r.played)?.id ?? null) : null;
  useIsoLayoutEffect(() => {
    const el = focusId != null ? anchorRef.current : null;
    if (!el) return;
    const scroll = () => el.scrollIntoView({ block: "start" });
    scroll(); // instant on desktop, no flash
    // Mobile fires this before the URL-bar viewport settles, so the scroll is dropped.
    // Re-assert once after it settles; a no-op if we're already in place.
    const timer = setTimeout(scroll, 250);
    return () => clearTimeout(timer);
  }, [focusId]);

  return (
    <div ref={rootRef} className="mx-auto max-w-3xl px-4">
      <header>
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-400">
          FIFA World Cup 2026 · Full Schedule
        </div>
        <h1 className="font-pixel mt-2 text-3xl font-bold tracking-tight">
          Every match by squad value
        </h1>
        <p className="mt-2 max-w-prose text-sm text-text-secondary">
          All {rows.length} matches — group fixtures and the knockout bracket — ranked by combined
          squad market value (live). Group scores fill in as games are played;{" "}
          <b className="text-amber-400">knockout</b> matchups are{" "}
          <b className="text-amber-400">projected</b> by value (higher value advances) until the
          real bracket fills in. Kickoffs in <b>CEST (UTC+2)</b>.
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
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-400">
              ✓ Confirmed
            </span>
            qualified into the slot
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="rounded-full border border-dashed border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-400">
              Proj
            </span>
            squad-value pick — chip shows why (group spot, best third…)
          </span>
        </div>
      </header>

      <section className="mt-8 flex flex-col gap-2.5">
        {sorted.map((row) => {
          const elapsed = now == null ? -1 : now - kickoffMs(row.kickoff);
          const status: Status = row.played
            ? "played"
            : !row.projected && elapsed >= 0 && elapsed < LIVE_WINDOW_MS
              ? "live"
              : row.id === focusId
                ? "next"
                : "upcoming";
          return (
            <MatchCard
              key={row.id}
              row={row}
              max={max}
              total={rows.length}
              status={status}
              cardRef={row.id === focusId ? anchorRef : undefined}
            />
          );
        })}
      </section>

      <footer className="mt-8 text-center text-xs text-text-muted">
        Combined squad market value · data from Transfermarkt · refreshed hourly
      </footer>
    </div>
  );
}

function TeamName({
  t,
  win,
  fav,
  confirmed,
}: {
  t: MatchupTeam;
  win: boolean;
  fav?: boolean;
  confirmed?: boolean;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-2 text-[15px]",
        win || fav || confirmed
          ? "font-bold text-text-primary"
          : "font-semibold text-text-secondary",
      )}
    >
      <span className="text-xl leading-none">{t.flag}</span>
      {t.short}
      {fav && (
        <span title="Projected to win on squad value" className="text-xs text-amber-400">
          ▸
        </span>
      )}
    </span>
  );
}

// The chip under a knockout team: green when it's confirmed into the slot, dashed
// amber when it's only a squad-value projection — and either way, why it sits there.
function SourceChip({ source, confirmed }: { source: string; confirmed: boolean }) {
  return (
    <span
      title={
        confirmed
          ? "Confirmed — this team has qualified into this slot"
          : "Projected — squad-value pick for this slot until the real team is decided"
      }
      className={clsx(
        "w-fit rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        confirmed
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
          : "border-dashed border-amber-500/40 bg-amber-500/10 text-amber-400",
      )}
    >
      {confirmed ? `✓ ${source}` : `Proj · ${source}`}
    </span>
  );
}

// A knockout slot: team name stacked over its confirmed/projected provenance chip.
function KoSlot({
  t,
  win,
  fav,
  confirmed,
  source,
}: {
  t: MatchupTeam;
  win: boolean;
  fav?: boolean;
  confirmed: boolean;
  source: string | null;
}) {
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <TeamName t={t} win={win} fav={fav} confirmed={confirmed} />
      {source && <SourceChip source={source} confirmed={confirmed} />}
    </span>
  );
}

function MatchCard({
  row,
  max,
  total,
  status,
  cardRef,
}: {
  row: MatchupRow;
  max: number;
  total: number;
  status: Status;
  cardRef?: Ref<HTMLDivElement>;
}) {
  const accent = "text-amber-400";
  const winner =
    row.played && row.hs !== row.as ? ((row.hs ?? 0) > (row.as ?? 0) ? "home" : "away") : null;
  // Before kickoff, flag the higher-value side as the value-model favourite.
  const fav = row.played ? null : row.home.mv >= row.away.mv ? "home" : "away";

  const sep = row.played ? (
    <span className="font-value px-1 text-base">
      {row.hs}
      <span className="px-0.5 text-text-muted">–</span>
      {row.as}
    </span>
  ) : (
    <span className="px-1 text-xs italic text-text-muted">v</span>
  );
  const nextUp = status === "next" && (
    <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-400">
      Next up
    </span>
  );

  return (
    <div
      ref={cardRef}
      className={clsx(
        "grid scroll-mt-16 grid-cols-1 items-center gap-3 rounded-xl border px-4 py-3 transition-[transform,border-color,background-color] duration-150 will-change-transform hover:-translate-y-0.5 sm:grid-cols-[5rem_1fr_auto] sm:gap-4 xl:scroll-mt-24",
        status === "live"
          ? "border-accent-cold/50 bg-accent-cold-faint"
          : status === "next"
            ? "border-amber-500/50 bg-amber-400/5"
            : "border-border-subtle bg-elevated hover:border-text-muted/50",
      )}
      data-mid={row.id}
    >
      <div className="flex items-baseline gap-2 sm:flex-col sm:items-start sm:gap-0 sm:border-r sm:border-border-subtle sm:pr-3">
        <span className="text-[11px] uppercase tracking-wide text-text-muted">{row.dow}</span>
        <span className="text-base font-bold">{row.dayLabel}</span>
        {status === "live" ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent-cold">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-cold opacity-75 motion-reduce:hidden" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-cold" />
            </span>
            LIVE
          </span>
        ) : (
          <span className={clsx("font-value text-xs", row.played ? "text-text-muted" : accent)}>
            {row.played ? "FT" : row.timeLabel}
          </span>
        )}
      </div>

      {row.stage === "group" ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <TeamName t={row.home} win={winner === "home"} fav={fav === "home"} />
          {sep}
          <TeamName t={row.away} win={winner === "away"} fav={fav === "away"} />
          {nextUp}
          <Badge variant="outline" className="text-text-muted">
            Group {row.group}
          </Badge>
          <span className="rounded-full border border-border-subtle px-2 py-0.5 text-[11px] text-text-muted">
            MD{row.matchday}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-start gap-x-2 gap-y-2">
            <KoSlot
              t={row.home}
              win={winner === "home"}
              fav={fav === "home"}
              confirmed={row.homeConfirmed}
              source={row.homeSource}
            />
            <span className="self-start pt-1">{sep}</span>
            <KoSlot
              t={row.away}
              win={winner === "away"}
              fav={fav === "away"}
              confirmed={row.awayConfirmed}
              source={row.awaySource}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {nextUp}
            <Badge variant="outline" className="text-text-muted">
              {ROUND_LABEL[row.stage]}
            </Badge>
          </div>
        </div>
      )}

      <div className="flex flex-col items-start gap-0.5 sm:items-end">
        <span className={clsx("font-value text-xl", accent)}>{fmt(row.sum)}</span>
        <span className="text-[11px] text-text-muted">
          #{row.vrank} of {total} by value
        </span>
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-border-subtle sm:w-32">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400"
            style={{ width: `${((row.sum / max) * 100).toFixed(1)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
