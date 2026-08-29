"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { SectionPanel } from "@/components/SectionPanel";
import { ClubLogo } from "@/components/ClubLogo";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import {
  formatMarketValue,
  formatPremium,
  formatRatio,
  getPlayerDetailHref,
  getTeamDetailHref,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  barGeometry,
  buildClubWindows,
  transferKey,
  type ClubSide,
  type ClubWindow,
  type PricedTransfer,
} from "@/lib/fee-vs-value";
import { TONE_TEXT, ValueToFee, type Tone } from "./TransferRow";
import { GapTrack } from "./FeeValueBar";

/** Clubs per table. Ten reaches past the handful of usual suspects at the top
 *  of any spending list into the mid-table business that is often the story. */
const TOP = 10;

type Side = "in" | "out";

/** One end of a mode's single ranking — its top, then its bottom. Only what
 *  actually differs between the two lives here; the measure itself is shared,
 *  which is what makes them genuine opposites rather than two similar tables. */
type EndSpec = {
  title: string;
  tone: Extract<Tone, "over" | "under">;
  /** Which side of the window a row expands into. */
  side: Side;
  /** Which clubs belong at this end at all. Defaults to "did something on that
   *  side of the window". */
  qualifies?: (c: ClubWindow) => boolean;
};

/** Which question a club table asks, and how it answers it. `sort` is descending;
 *  the second end reads the same order from the other end. */
export type ModeSpec = {
  /** What this mode is called in the URL. */
  slug: string;
  toggle: string;
  title: string;
  blurb: string;
  sort: (c: ClubWindow) => number;
  /** The big figure on each row. */
  figure: (c: ClubWindow) => string;
  caption: (c: ClubWindow) => string;
  /** Small figure under it. Defaults to the fee-to-value ratio of that side. */
  badge?: (c: ClubWindow) => string | null;
  /** Draw the value-against-fees bar under the caption. Off where the mode ranks
   *  on something else — a bar plotting figures the row isn't ranked on reads as
   *  a contradiction, or worse, as a control. */
  bar?: boolean;
  /** Which moves an expanded row lists. Defaults to the end's own `side`, which
   *  is right when the headline only counts one side. Where it nets the two —
   *  squad value — the expansion has to show both, or half the number it is
   *  explaining is missing from the list underneath it. */
  expand?: "in" | "out" | "both";
  ends: [EndSpec, EndSpec];
};

const money = formatMarketValue;
const signed = formatPremium;

export const CLUB_MODES = {
  buying: {
    slug: "buying",
    bar: true,
    toggle: "Buying",
    title: "Who bought well",
    blurb:
      "Fees paid against what the players were worth. A club that paid under value shopped well.",
    sort: (c) => c.in.premium,
    figure: (c) => signed(c.in.premium),
    caption: (c) => `${money(c.in.marketValue)} of players for ${money(c.in.fees)}`,
    ends: [
      { title: "Paid over the odds", tone: "over", side: "in" },
      { title: "Shopped best", tone: "under", side: "in" },
    ],
  },
  selling: {
    slug: "selling",
    bar: true,
    toggle: "Selling",
    title: "Who sold well",
    blurb:
      "The same sum from the other end: fees banked against what the players leaving were worth.",
    sort: (c) => c.out.premium,
    figure: (c) => signed(c.out.premium),
    caption: (c) => `${money(c.out.marketValue)} of players for ${money(c.out.fees)}`,
    ends: [
      // Banking more than a player was worth is the good outcome here, so the
      // colours run opposite to the buying tables.
      { title: "Sold above value", tone: "under", side: "out" },
      { title: "Sold below value", tone: "over", side: "out" },
    ],
  },
  "squad-value": {
    slug: "squad-value",
    toggle: "Squad value",
    title: "Who gained and who lost",
    blurb:
      "Value in minus value out, whatever it cost. The badge is the money that swing took, in fees paid minus fees banked.",
    // Ranked on net, not on gross: a club that brings in €292m and lets €268m
    // go has not gained €292m of anything. Gross sits in the caption, and the
    // two ends are genuine opposites — no club can top both.
    sort: (c) => c.netValue,
    figure: (c) => signed(c.netValue),
    caption: (c) => `${money(c.in.marketValue)} in · ${money(c.out.marketValue)} out`,
    badge: (c) => `${signed(c.netSpend)} net`,
    // The figure nets both sides, so the expansion has to list both.
    expand: "both",
    ends: [
      {
        title: "Gained the most value",
        tone: "under",
        side: "in",
        qualifies: (c) => c.netValue > 0,
      },
      {
        title: "Lost the most value",
        tone: "over",
        side: "out",
        qualifies: (c) => c.netValue < 0,
      },
    ],
  },
} satisfies Record<string, ModeSpec>;

/** The three cuts, keyed by the slug that names them in the URL. `slug` was
 *  always the public name; keying on it too means there is one vocabulary for a
 *  mode rather than an internal name and a URL name that had to be mapped
 *  between. */
export type ClubMode = keyof typeof CLUB_MODES;

/** Paying above a player's value is the bad outcome on the way in and the good
 *  one on the way out. Landing exactly on it is neither, so it stays uncoloured
 *  rather than borrowing the bargain green. */
function moveTone(t: PricedTransfer, side: Side): Tone {
  if (t.premium === 0) return "neutral";
  const aboveValue = t.premium > 0;
  return (side === "in" ? aboveValue : !aboveValue) ? "over" : "under";
}

/** One move inside an expanded club: who, what he was worth, what he cost. */
function MoveRow({ t, side }: { t: PricedTransfer; side: Side }) {
  const other = side === "in" ? t.from : t.to;
  return (
    <li className="flex items-center gap-2 py-1.5">
      <PlayerAvatar imageUrl={t.imageUrl} name={t.name} className="size-6 rounded" />
      <span className="min-w-0 flex-1">
        <Link
          href={getPlayerDetailHref(t.playerId)}
          className="block truncate text-xs font-bold text-text-primary hover:underline"
        >
          {t.name}
        </Link>
        {other.name && (
          <span className="block truncate text-xs text-text-muted">
            {side === "in" ? "from" : "to"} {other.name}
          </span>
        )}
        {/* The price rides under the name on phones, where there is no room for
            it beside one. */}
        <span className="mt-0.5 block sm:hidden">
          <ValueToFee transfer={t} />
        </span>
      </span>
      {t.isLoan && (
        <span className="shrink-0 text-[10px] uppercase tracking-wider text-text-muted">loan</span>
      )}
      <span className="hidden shrink-0 sm:block">
        <ValueToFee transfer={t} />
      </span>
      <span
        className={cn(
          "w-20 shrink-0 text-right font-value text-xs",
          // On the way out, banking above value is the good outcome.
          TONE_TEXT[moveTone(t, side)],
        )}
      >
        {formatPremium(t.premium)}
      </span>
    </li>
  );
}

function sideLabel(s: ClubSide, side: Side) {
  const extras = [
    s.loans > 0 && `${s.loans} ${s.loans === 1 ? "loan" : "loans"}`,
    s.frees > 0 && `${s.frees} free`,
  ].filter(Boolean);
  return `${s.players} ${side}${extras.length ? ` · ${extras.join(" · ")}` : ""}`;
}

function ClubRow({
  c,
  mode,
  end,
  axisMax,
}: {
  c: ClubWindow;
  mode: ModeSpec;
  end: EndSpec;
  /** Shared euro axis for the fee-vs-value bar, across both tables. */
  axisMax: number;
}) {
  const [open, setOpen] = useState(false);
  const side = c[end.side];
  const badge = mode.badge ? mode.badge(c) : side.marketValue > 0 ? formatRatio(side.ratio) : null;
  // Labels only when both sides are on show; a single-sided expansion needs no
  // heading telling you what you already picked.
  const groups = (
    mode.expand === "both"
      ? ([
          { key: "in", label: "In" },
          { key: "out", label: "Out" },
        ] as const)
      : ([{ key: mode.expand ?? end.side, label: null }] as const)
  ).filter((g) => c[g.key].transfers.length > 0);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-lg border border-border-subtle bg-card"
    >
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-3 p-2.5 text-left transition-colors hover:bg-card-hover">
        <ChevronDown
          aria-hidden
          className={cn(
            "size-3.5 shrink-0 text-text-muted transition-transform",
            open && "rotate-180",
          )}
        />
        {c.club.logoUrl && <ClubLogo src={c.club.logoUrl} />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-text-primary">{c.club.name}</span>
          <span className="mt-0.5 block font-value text-xs text-text-secondary">
            {mode.caption(c)}
            <span className="text-text-muted"> · {sideLabel(side, end.side)}</span>
          </span>
          {/* The caption's two figures, drawn — the same mark the player rows
              use, so a club window reads like one big transfer. */}
          {mode.bar && side.marketValue > 0 && (
            <GapTrack
              {...barGeometry({ worth: side.marketValue, fee: side.fees }, axisMax)}
              className="mt-1.5"
            />
          )}
        </span>
        <span className="shrink-0 text-right">
          <span className={cn("block font-value text-sm", TONE_TEXT[end.tone])}>
            {mode.figure(c)}
          </span>
          {badge && (
            <Badge variant="outline" className="mt-0.5 font-value">
              {badge}
            </Badge>
          )}
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent>
        {groups.map(({ key, label }) => (
          <div key={key} className="border-t border-border-subtle">
            {label && (
              <p className="px-2.5 pt-2 text-[10px] uppercase tracking-[0.18em] text-text-muted">
                {label}
              </p>
            )}
            <ul className="divide-y divide-border-subtle px-2.5">
              {c[key].transfers.map((t) => (
                <MoveRow key={transferKey(t)} t={t} side={key} />
              ))}
            </ul>
          </div>
        ))}
        {/* The club name in the header can't be a link — it sits inside the
            trigger button — so the way through to the squad lives down here. */}
        {c.club.clubId && (
          <div className="px-2.5 py-2">
            <Link
              href={getTeamDetailHref(c.club.clubId)}
              className="text-xs text-accent-blue hover:underline"
            >
              {c.club.name} squad →
            </Link>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ClubTable({
  rows,
  mode,
  end,
  bottom,
  axisMax,
}: {
  rows: ClubWindow[];
  mode: ModeSpec;
  end: EndSpec;
  /** Read the shared ranking from its bottom rather than its top. */
  bottom: boolean;
  axisMax: number;
}) {
  const top = useMemo(() => {
    const ranked = rows
      .filter((c) => c[end.side].players > 0 && (end.qualifies?.(c) ?? true))
      .sort((a, b) => mode.sort(b) - mode.sort(a));
    return (bottom ? ranked.reverse() : ranked).slice(0, TOP);
  }, [rows, mode, end, bottom]);

  if (top.length === 0) return <p className="text-sm text-text-muted">No clubs qualify.</p>;
  return (
    <ul className="space-y-2">
      {top.map((c) => (
        <li key={c.club.clubId || c.club.name}>
          <ClubRow c={c} mode={mode} end={end} axisMax={axisMax} />
        </li>
      ))}
    </ul>
  );
}

export function ClubTables({ transfers, spec }: { transfers: PricedTransfer[]; spec: ModeSpec }) {
  // Loans are a scope on the data rather than a different question, so they sit
  // here beside the tables instead of competing with the mode toggle above.
  const [withLoans, setWithLoans] = useState(true);
  // Aggregated here rather than on the server: both cuts are rearrangements of
  // the transfers the page already holds, and shipping them pre-built put every
  // move on the wire four more times.
  const rows = useMemo(
    () => buildClubWindows(withLoans ? transfers : transfers.filter((t) => !t.isLoan)),
    [transfers, withLoans],
  );
  // One euro axis across both tables, so the bar on a club that spent €292m is
  // visibly longer than the bar on one that spent €40m.
  const axisMax = useMemo(
    () =>
      rows.reduce(
        (max, c) => Math.max(max, c.in.fees, c.in.marketValue, c.out.fees, c.out.marketValue),
        0,
      ),
    [rows],
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-xs text-text-muted">
          Bars run value against fees, as on the player lists.
        </span>
        <ToggleGroup
          type="single"
          value={withLoans ? "with" : "without"}
          onValueChange={(v) => v && setWithLoans(v === "with")}
          variant="outline"
          size="sm"
          className="rounded-lg"
          aria-label="Count loans"
        >
          <ToggleGroupItem value="with" className="rounded-l-lg">
            With loans
          </ToggleGroupItem>
          <ToggleGroupItem value="without" className="rounded-r-lg">
            Permanent only
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {spec.ends.map((end, i) => (
          <SectionPanel key={end.title} title={end.title}>
            <ClubTable rows={rows} mode={spec} end={end} bottom={i === 1} axisMax={axisMax} />
          </SectionPanel>
        ))}
      </div>
    </div>
  );
}
