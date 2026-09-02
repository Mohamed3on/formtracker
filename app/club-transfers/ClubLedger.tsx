"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
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
import { ClubLogo } from "@/components/ClubLogo";
import { ClubMoveRow } from "@/app/fee-vs-value/TransferRow";
import { transferKey, type ClubWindow } from "@/lib/fee-vs-value";
import {
  CLUB_MODES,
  TONE_TEXT,
  doubled,
  endKeyOf,
  gainTone,
  premiumTone,
  rankClubs,
  surplus,
  windowSentence,
  type EndKey,
  type ModeSpec,
} from "@/lib/fee-vs-value-rankings";
import { formatMarketValue, formatPremium, getTeamDetailHref } from "@/lib/format";
import { cn } from "@/lib/utils";

const money = formatMarketValue;
const signed = formatPremium;

/**
 * What the ledger is sorted on: one of the four club rankings, or the cash
 * net, which is a column with no end to lead and no badge to win, so it sorts
 * here and nowhere else.
 */
export type LedgerSort = { mode: ModeSpec; endIndex: 0 | 1 } | { net: EndKey };

export function isNetSort(sort: LedgerSort): sort is { net: EndKey } {
  return "net" in sort;
}

/** "Who shopped best" — the end's own title, asked as a question. */
export function ledgerTitle(sort: LedgerSort): string {
  if (isNetSort(sort)) return sort.net === "best" ? "Who banked the most" : "Who spent the most";
  const { title } = sort.mode.ends[sort.endIndex];
  return `Who ${title.charAt(0).toLowerCase()}${title.slice(1)}`;
}

export function ledgerBlurb(sort: LedgerSort): string {
  if (isNetSort(sort)) {
    return "Fees banked minus fees paid, among the window's biggest deals. Every deal, in cash, is in the money table below.";
  }
  return sort.mode.blurb;
}

/**
 * The ledger's order for a sort. A ranking's order is `rankClubs`'s — the one
 * the club-page badges are read from, so a club badged "Shopped best" is by
 * construction the first row of that view — with the clubs that don't qualify
 * for the end continuing underneath in the same direction, so the table is
 * still every club rather than the end alone.
 */
export function orderRows(rows: ClubWindow[], sort: LedgerSort): ClubWindow[] {
  if (isNetSort(sort)) {
    const byNet = [...rows].sort((a, b) => a.netSpend - b.netSpend);
    return sort.net === "best" ? byNet : byNet.reverse();
  }
  const { mode, endIndex } = sort;
  const ranked = rankClubs(rows, mode, endIndex);
  const seen = new Set(ranked);
  const rest = rows.filter((c) => !seen.has(c)).sort((a, b) => mode.sort(b) - mode.sort(a));
  return [...ranked, ...(endIndex === 1 ? rest.reverse() : rest)];
}

type ColumnKey = "buying" | "selling" | "squad-value" | "net" | "overall";

interface Column {
  key: ColumnKey;
  label: string;
  /** The arithmetic, printed under the label so every column says what it is. */
  sum: string;
  mode?: ModeSpec;
}

const COLUMNS: Column[] = [
  { key: "buying", label: "Bought", sum: "fee − worth", mode: CLUB_MODES.buying },
  { key: "selling", label: "Sold", sum: "fee − worth", mode: CLUB_MODES.selling },
  {
    key: "squad-value",
    label: "Squad value",
    sum: "value in − out",
    mode: CLUB_MODES["squad-value"],
  },
  { key: "net", label: "Net", sum: "banked − spent" },
  { key: "overall", label: "Overall", sum: "value added − money spent", mode: CLUB_MODES.overall },
];

function activeKey(sort: LedgerSort): ColumnKey {
  return isNetSort(sort) ? "net" : (sort.mode.slug as ColumnKey);
}

function endOf(sort: LedgerSort): EndKey {
  return isNetSort(sort) ? sort.net : endKeyOf(sort.mode, sort.endIndex);
}

/** One side's premium with the two figures it came from under it. The sign is
 *  the site's — fee minus worth — and the colour says which way is good. */
function SideCell({ c, side }: { c: ClubWindow; side: "in" | "out" }) {
  const s = c[side];
  if (s.players === 0) return <span className="text-text-muted">—</span>;
  return (
    <>
      <span className={cn("block font-value", TONE_TEXT[premiumTone(s.premium, side)])}>
        {signed(s.premium)}
      </span>
      <span className="block font-value text-[10px] text-text-muted md:whitespace-nowrap">
        {money(s.marketValue)} of players for {money(s.fees)}
      </span>
    </>
  );
}

function OverallCell({ c }: { c: ClubWindow }) {
  const s = surplus(c);
  return (
    <>
      <span className={cn("block font-value", TONE_TEXT[gainTone(s)])}>{signed(s)}</span>
      <span className="block font-value text-[10px] text-text-muted md:whitespace-nowrap">
        {windowSentence(c)}
      </span>
      {doubled(c) && (
        <Badge variant="outline" className="mt-0.5 font-normal">
          banked &amp; stronger
        </Badge>
      )}
    </>
  );
}

function ClubCell({ c }: { c: ClubWindow }) {
  const sides = c.in.players === 0 ? "sold only" : c.out.players === 0 ? "bought only" : null;
  return (
    <div className="flex items-center gap-2">
      {c.club.logoUrl && <ClubLogo src={c.club.logoUrl} />}
      <div className="min-w-0">
        <span className="flex flex-wrap items-baseline gap-x-1.5">
          {c.club.clubId ? (
            <Link
              href={getTeamDetailHref(c.club.clubId)}
              className="truncate text-sm font-bold hover:underline"
            >
              {c.club.name}
            </Link>
          ) : (
            <span className="truncate text-sm font-bold">{c.club.name}</span>
          )}
          {c.club.league && (
            <span className="text-[10px] uppercase tracking-wide text-text-muted">
              {c.club.league}
            </span>
          )}
        </span>
        <span className="block font-value text-[10px] text-text-muted md:whitespace-nowrap">
          {c.in.players} in · {c.out.players} out{sides && ` · ${sides}`}
        </span>
      </div>
    </div>
  );
}

/** The deals behind a club's row, one list per side, with the way through to
 *  the squad at the bottom. */
function ClubDeals({ c }: { c: ClubWindow }) {
  const sides = (["in", "out"] as const).filter((s) => c[s].transfers.length > 0);
  return (
    <>
      {sides.map((side) => (
        <div key={side} className="border-t border-border-subtle">
          <p className="px-2.5 pt-2 text-[10px] uppercase tracking-[0.18em] text-text-muted">
            {side}
          </p>
          <ul className="divide-y divide-border-subtle px-2.5">
            {c[side].transfers.map((t) => (
              <ClubMoveRow key={transferKey(t)} t={t} side={side} />
            ))}
          </ul>
        </div>
      ))}
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
    </>
  );
}

const keyOf = (c: ClubWindow) => c.club.clubId || c.club.name;

/**
 * Every club in the window, one row each, every judgement a column.
 *
 * Bought and Sold are the two premiums, in the site's sign — fee minus worth,
 * so a bargain reads negative and green on the way in and a good sale positive
 * and green on the way out, exactly as the club's own page prints them.
 * Overall nets the whole window. A row opens into the deals behind it.
 */
export function ClubLedger({
  rows,
  sort,
  onSort,
}: {
  rows: ClubWindow[];
  sort: LedgerSort;
  /** A column header was clicked: that column, best end first, or the other
   *  end if it was already leading. */
  onSort: (key: ColumnKey, end: EndKey) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const ordered = useMemo(() => orderRows(rows, sort), [rows, sort]);
  const active = activeKey(sort);
  const end = endOf(sort);

  const clickHeader = (key: ColumnKey) =>
    onSort(key, key === active ? (end === "best" ? "worst" : "best") : "best");

  if (rows.length === 0) return <p className="text-sm text-text-muted">No clubs in this league.</p>;

  return (
    <>
      {/* Phones get cards with the verdict and a sort picker. */}
      <div className="space-y-3 md:hidden">
        <div className="flex items-center gap-2">
          <SelectNative
            aria-label="Sort clubs by"
            value={active}
            onChange={(e) => onSort(e.target.value as ColumnKey, "best")}
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
            aria-label={end === "best" ? "Show the worst first" : "Show the best first"}
            onClick={() => onSort(active, end === "best" ? "worst" : "best")}
          >
            {end === "best" ? "Best" : "Worst"}
          </Button>
        </div>
        {ordered.map((c) => (
          <Card key={keyOf(c)}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-3">
                <ClubCell c={c} />
                <div className="shrink-0 text-right">
                  <p className="text-[10px] uppercase tracking-wide text-text-muted">Overall</p>
                  <OverallCell c={c} />
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border-subtle pt-2 text-xs">
                <div>
                  <dt className="text-text-muted">Bought · fee − worth</dt>
                  <dd>
                    <SideCell c={c} side="in" />
                  </dd>
                </div>
                <div className="text-right">
                  <dt className="text-text-muted">Sold · fee − worth</dt>
                  <dd>
                    <SideCell c={c} side="out" />
                  </dd>
                </div>
                <div>
                  <dt className="text-text-muted">Squad value</dt>
                  <dd className={cn("font-value", TONE_TEXT[gainTone(c.netValue)])}>
                    {signed(c.netValue)}
                  </dd>
                </div>
                <div className="text-right">
                  <dt className="text-text-muted">Net · banked − spent</dt>
                  <dd className={cn("font-value", TONE_TEXT[gainTone(-c.netSpend)])}>
                    {signed(-c.netSpend)}
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
              <TableHead className="w-8" />
              <TableHead className="align-bottom">Club</TableHead>
              {COLUMNS.map((col) => (
                <TableHead key={col.key} className="text-right align-bottom">
                  <button
                    onClick={() => clickHeader(col.key)}
                    className={cn(
                      "inline-flex cursor-pointer flex-col items-end gap-0.5 hover:text-text-primary",
                      active === col.key && "text-text-primary",
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      <span className="text-xs opacity-60">
                        {active === col.key ? (end === "best" ? "▼" : "▲") : "↕"}
                      </span>
                    </span>
                    <span className="font-value text-[10px] normal-case tracking-normal text-text-muted">
                      {col.sum}
                    </span>
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordered.map((c) => {
              const k = keyOf(c);
              const isOpen = open === k;
              return (
                <Fragment key={k}>
                  <TableRow
                    className={cn("cursor-pointer", isOpen && "bg-elevated")}
                    onClick={() => setOpen(isOpen ? null : k)}
                  >
                    <TableCell className="pr-0">
                      <ChevronDown
                        aria-hidden
                        className={cn(
                          "size-3.5 text-text-muted transition-transform",
                          isOpen && "rotate-180",
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <ClubCell c={c} />
                    </TableCell>
                    <TableCell className="text-right">
                      <SideCell c={c} side="in" />
                    </TableCell>
                    <TableCell className="text-right">
                      <SideCell c={c} side="out" />
                    </TableCell>
                    <TableCell
                      className={cn("font-value text-right", TONE_TEXT[gainTone(c.netValue)])}
                    >
                      {signed(c.netValue)}
                    </TableCell>
                    <TableCell
                      className={cn("font-value text-right", TONE_TEXT[gainTone(-c.netSpend)])}
                    >
                      {signed(-c.netSpend)}
                    </TableCell>
                    <TableCell className="text-right">
                      <OverallCell c={c} />
                    </TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={7} className="bg-elevated p-0">
                        <div className="px-3 pb-1">
                          <ClubDeals c={c} />
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
