import type { ReactNode } from "react";
import clsx from "clsx";
import { fmtS } from "@/lib/wc/format";
import type { MatchupRow, MatchupTeam, Stage } from "@/lib/wc/matchups";

// Value ratio of a matchup: 1 = identical squad values, → 0 = total mismatch.
const ratio = (r: MatchupRow) => {
  const hi = Math.max(r.home.mv, r.away.mv);
  return hi > 0 ? Math.min(r.home.mv, r.away.mv) / hi : 1;
};

// Coin-flip score: evenness × combined value, so a tight clash of heavyweights
// outranks two equally-matched minnows.
const evenStakes = (r: MatchupRow) => ratio(r) * r.sum;

// "58×" for a runaway gap, "3.5×" when it's closer.
const mult = (x: number) => (x >= 10 ? `${Math.round(x)}×` : `${x.toFixed(1)}×`);

type Kind = "tight" | "mismatch" | "shock";
type Card = { kind: Kind; row: MatchupRow };

const META: Record<Kind, { label: string; accent: string; card: string }> = {
  tight: {
    label: "Tightest on paper",
    accent: "text-sky-400",
    card: "border-sky-500/30 bg-sky-500/5",
  },
  mismatch: {
    label: "Biggest mismatch",
    accent: "text-amber-400",
    card: "border-amber-500/30 bg-amber-400/5",
  },
  shock: {
    label: "Biggest shock so far",
    accent: "text-accent-cold",
    card: "border-accent-cold/40 bg-accent-cold-faint",
  },
};

const STAGE_LABEL: Record<Exclude<Stage, "group">, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-final",
  SF: "Semi-final",
  F: "Final",
  "3RD": "3rd place",
};

// The three value storylines, drawn from the full schedule:
//   • tight    — the most evenly valued high-stakes matchup (a coin flip that matters)
//   • mismatch — the most lopsided matchup (David v Goliath)
//   • shock    — the biggest upset already played (a cheaper squad that won)
// Knockout slots still projected by value are skipped: their teams aren't real yet.
function pickCards(rows: MatchupRow[]): Card[] {
  const real = rows.filter((r) => !r.projected && r.home.mv > 0 && r.away.mv > 0);
  if (!real.length) return [];

  const cards: Card[] = [
    { kind: "tight", row: real.reduce((a, b) => (evenStakes(b) > evenStakes(a) ? b : a)) },
    { kind: "mismatch", row: real.reduce((a, b) => (ratio(b) < ratio(a) ? b : a)) },
  ];

  const shock = real
    .filter((r) => r.played && r.winner)
    .map((r) => {
      const winMv = r.winner === "home" ? r.home.mv : r.away.mv;
      const loseMv = r.winner === "home" ? r.away.mv : r.home.mv;
      return { row: r, edge: loseMv / winMv };
    })
    .filter((x) => x.edge > 1) // the lower-value side won
    .sort((a, b) => b.edge - a.edge)[0];
  if (shock) cards.push({ kind: "shock", row: shock.row });

  return cards;
}

export function WcHighlights({ rows }: { rows: MatchupRow[] }) {
  const cards = pickCards(rows);
  if (!cards.length) return null;
  return (
    <section className="mt-8">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
        Standout matchups
      </h2>
      <div
        className={clsx(
          "mt-3 grid grid-cols-1 gap-3",
          cards.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
        )}
      >
        {cards.map((c) => (
          <HighlightCard key={c.kind} {...c} />
        ))}
      </div>
    </section>
  );
}

const Num = ({ children }: { children: ReactNode }) => (
  <span className="font-value">{children}</span>
);

function Side({ t, bold, mute }: { t: MatchupTeam; bold?: boolean; mute?: boolean }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5",
        mute
          ? "font-medium text-text-muted"
          : bold
            ? "font-bold text-text-primary"
            : "font-semibold text-text-secondary",
      )}
    >
      <span className="text-lg leading-none">{t.flag}</span>
      {t.short}
    </span>
  );
}

function HighlightCard({ kind, row }: Card) {
  const m = META[kind];
  const homeHigh = row.home.mv >= row.away.mv;
  const winHome = row.winner === "home";

  // Emphasis: shock → the winner; mismatch → the favourite (higher value); tight → neither.
  const bold =
    kind === "shock"
      ? { home: winHome, away: row.winner === "away" }
      : kind === "mismatch"
        ? { home: homeHigh, away: !homeHigh }
        : { home: false, away: false };
  const mute = kind === "shock" ? { home: !winHome, away: winHome } : { home: false, away: false };

  const sep =
    row.played && row.hs != null && row.as != null ? (
      <span className="inline-flex items-baseline px-0.5">
        <span className="font-value text-base">
          {row.hs}
          <span className="px-0.5 text-text-muted">–</span>
          {row.as}
        </span>
        {row.pens && (
          <span className="ml-1 text-xs text-text-muted" title="Decided on penalties">
            (pens)
          </span>
        )}
      </span>
    ) : (
      <span className="px-1 text-xs italic text-text-muted">v</span>
    );

  const stat = ((): { primary: ReactNode; secondary: ReactNode } => {
    if (kind === "tight")
      return {
        primary: (
          <>
            within <Num>{Math.max(1, Math.round((1 - ratio(row)) * 100))}%</Num>
          </>
        ),
        secondary: (
          <>
            <Num>{fmtS(row.sum)}</Num> combined
          </>
        ),
      };
    const hi = homeHigh ? row.home : row.away;
    const lo = homeHigh ? row.away : row.home;
    if (kind === "mismatch")
      return {
        primary: (
          <>
            <Num>{mult(hi.mv / lo.mv)}</Num> gap
          </>
        ),
        secondary: (
          <>
            <Num>{fmtS(hi.mv)}</Num> v <Num>{fmtS(lo.mv)}</Num>
          </>
        ),
      };
    const win = winHome ? row.home : row.away;
    const lose = winHome ? row.away : row.home;
    return {
      primary: (
        <>
          <Num>{mult(lose.mv / win.mv)}</Num> upset
        </>
      ),
      secondary: (
        <>
          <Num>{fmtS(win.mv)}</Num> beat <Num>{fmtS(lose.mv)}</Num>
        </>
      ),
    };
  })();

  const context = row.stage === "group" ? `Group ${row.group}` : STAGE_LABEL[row.stage];

  return (
    <div className={clsx("flex flex-col gap-2 rounded-xl border p-3", m.card)}>
      <div className="flex items-center justify-between gap-2">
        <span className={clsx("text-[11px] font-semibold uppercase tracking-wider", m.accent)}>
          {m.label}
        </span>
        <span className="text-[11px] text-text-muted">{context}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[15px]">
        <Side t={row.home} bold={bold.home} mute={mute.home} />
        {sep}
        <Side t={row.away} bold={bold.away} mute={mute.away} />
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className={clsx("text-sm", m.accent)}>{stat.primary}</span>
        <span className="text-xs text-text-muted">{stat.secondary}</span>
      </div>
    </div>
  );
}
