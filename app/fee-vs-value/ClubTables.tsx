"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { SectionPanel } from "@/components/SectionPanel";
import { ClubLogo } from "@/components/ClubLogo";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { formatMarketValue, getPlayerDetailHref, getTeamDetailHref } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ClubSide, ClubWindow, FeeVsValueData } from "@/lib/fee-vs-value";
import { formatPremium, formatRatio } from "./TransferRow";
import type { TopTransfer } from "@/app/types";

const TOP = 5;

export type ClubMode = "spending" | "selling" | "value";

/** Which side of the window a table reads, and what it does with it. `sort` is
 *  descending; `flip` takes the same order from the other end. */
type TableSpec = {
  title: string;
  side: "in" | "out";
  sort: (c: ClubWindow) => number;
  flip?: boolean;
  /** What the big figure on each row shows. */
  figure: (c: ClubWindow) => string;
  caption: (c: ClubWindow) => string;
  tone: "over" | "under";
};

const money = (n: number) => formatMarketValue(n);
const signed = (n: number) => formatPremium(n);

export const CLUB_MODES: Record<
  ClubMode,
  { toggle: string; title: string; blurb: string; tables: [TableSpec, TableSpec] }
> = {
  spending: {
    toggle: "Buying",
    title: "Who bought well",
    blurb:
      "Fees paid against what the players were worth. A club that paid under value shopped well.",
    tables: [
      {
        title: "Paid over the odds",
        side: "in",
        sort: (c) => c.in.premium,
        figure: (c) => signed(c.in.premium),
        caption: (c) => `${money(c.in.fees)} for ${money(c.in.marketValue)} of players`,
        tone: "over",
      },
      {
        title: "Shopped best",
        side: "in",
        sort: (c) => c.in.premium,
        flip: true,
        figure: (c) => signed(c.in.premium),
        caption: (c) => `${money(c.in.fees)} for ${money(c.in.marketValue)} of players`,
        tone: "under",
      },
    ],
  },
  selling: {
    toggle: "Selling",
    title: "Who sold well",
    blurb:
      "The same sum from the other end: fees banked against what the players leaving were worth.",
    tables: [
      {
        title: "Sold above value",
        side: "out",
        sort: (c) => c.out.premium,
        // Banking more than a player was worth is the good outcome here, so the
        // colours run opposite to the buying tables.
        figure: (c) => signed(c.out.premium),
        caption: (c) => `${money(c.out.fees)} for ${money(c.out.marketValue)} of players`,
        tone: "under",
      },
      {
        title: "Sold below value",
        side: "out",
        sort: (c) => c.out.premium,
        flip: true,
        figure: (c) => signed(c.out.premium),
        caption: (c) => `${money(c.out.fees)} for ${money(c.out.marketValue)} of players`,
        tone: "over",
      },
    ],
  },
  value: {
    toggle: "Squad value",
    title: "Who gained and who lost",
    blurb:
      "Market value moved in and out, whatever it cost. Net is what the squad is worth after both.",
    tables: [
      {
        title: "Gained the most value",
        side: "in",
        sort: (c) => c.in.marketValue,
        figure: (c) => money(c.in.marketValue),
        caption: (c) => `net ${signed(c.netValue)} after ${money(c.out.marketValue)} out`,
        tone: "under",
      },
      {
        title: "Lost the most value",
        side: "out",
        sort: (c) => c.out.marketValue,
        figure: (c) => money(c.out.marketValue),
        caption: (c) => `net ${signed(c.netValue)} after ${money(c.in.marketValue)} in`,
        tone: "over",
      },
    ],
  },
};

/** One move inside an expanded club: who, what he was worth, what he cost. */
function MoveRow({ t, side }: { t: TopTransfer; side: "in" | "out" }) {
  const premium = t.fee - t.marketValue;
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
          <span className="block truncate text-[11px] text-text-muted">
            {side === "in" ? "from" : "to"} {other.name}
          </span>
        )}
      </span>
      {t.isLoan && (
        <span className="shrink-0 text-[10px] uppercase tracking-wider text-text-muted">loan</span>
      )}
      <span className="shrink-0 font-value text-xs text-text-secondary">
        {formatMarketValue(t.marketValue)}
        <span className="mx-1 text-text-muted">→</span>
        {t.fee > 0 ? formatMarketValue(t.fee) : t.feeText}
      </span>
      <span
        className={cn(
          "w-20 shrink-0 text-right font-value text-xs",
          // On the way out, banking above value is the good outcome.
          (side === "in" ? premium > 0 : premium < 0) ? "text-accent-cold" : "text-accent-hot",
        )}
      >
        {formatPremium(premium)}
      </span>
    </li>
  );
}

function sideLabel(s: ClubSide, side: "in" | "out") {
  const noun = side === "in" ? "in" : "out";
  const extras = [
    s.loans > 0 && `${s.loans} ${s.loans === 1 ? "loan" : "loans"}`,
    s.frees > 0 && `${s.frees} free`,
  ].filter(Boolean);
  return `${s.players} ${noun}${extras.length ? ` · ${extras.join(" · ")}` : ""}`;
}

function ClubRow({ c, spec }: { c: ClubWindow; spec: TableSpec }) {
  const [open, setOpen] = useState(false);
  const side = c[spec.side];
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
            {spec.caption(c)}
            <span className="text-text-muted"> · {sideLabel(side, spec.side)}</span>
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span
            className={cn(
              "block font-value text-sm",
              spec.tone === "over" ? "text-accent-cold" : "text-accent-hot",
            )}
          >
            {spec.figure(c)}
          </span>
          {side.marketValue > 0 && (
            <Badge variant="outline" className="mt-0.5 font-value">
              {formatRatio(side.ratio)}
            </Badge>
          )}
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <ul className="divide-y divide-border-subtle border-t border-border-subtle px-2.5">
          {side.transfers.map((t) => (
            <MoveRow key={t.playerId} t={t} side={spec.side} />
          ))}
        </ul>
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

function ClubTable({ rows, spec }: { rows: ClubWindow[]; spec: TableSpec }) {
  const ranked = rows
    .filter((c) => c[spec.side].players > 0)
    .sort((a, b) => spec.sort(b) - spec.sort(a));
  const top = (spec.flip ? ranked.reverse() : ranked).slice(0, TOP);

  if (top.length === 0) return <p className="text-sm text-text-muted">No clubs qualify.</p>;
  return (
    <ul className="space-y-2">
      {top.map((c) => (
        <li key={c.club.clubId || c.club.name}>
          <ClubRow c={c} spec={spec} />
        </li>
      ))}
    </ul>
  );
}

export function ClubTables({ clubs, mode }: { clubs: FeeVsValueData["clubs"]; mode: ClubMode }) {
  // Loans are a scope on the data rather than a different question, so they sit
  // here beside the tables instead of competing with the mode toggle above.
  const [withLoans, setWithLoans] = useState(true);
  const rows = withLoans ? clubs.withLoans : clubs.permanentOnly;
  const { tables } = CLUB_MODES[mode];

  return (
    <div>
      <div className="flex justify-end">
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
        {tables.map((spec) => (
          <SectionPanel key={spec.title} title={spec.title}>
            <ClubTable rows={rows} spec={spec} />
          </SectionPanel>
        ))}
      </div>
    </div>
  );
}
