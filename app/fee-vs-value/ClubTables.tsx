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
import { formatPremium, formatRatio, getPlayerDetailHref, getTeamDetailHref } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  barGeometry,
  buildClubWindows,
  transferKey,
  type ClubSide,
  type ClubWindow,
  type PricedTransfer,
} from "@/lib/fee-vs-value";
import { useQueryParams } from "@/lib/hooks/use-query-params";
import {
  PATH,
  cutTransfers,
  inLeague,
  rankClubs,
  resolveLoans,
  type ModeSpec,
  type Side,
  type Tone,
} from "@/lib/fee-vs-value-rankings";
import { TONE_TEXT, ValueToFee } from "./TransferRow";
import { GapTrack } from "./FeeValueBar";

/** Clubs per table. Twenty reaches well past the handful of usual suspects at
 *  the top of any spending list into the mid-table business that is often the
 *  story — 118 clubs did business in this window, and the twentieth-placed one
 *  is still moving tens of millions of value either way. */
const TOP = 20;

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
  endIndex,
  axisMax,
}: {
  c: ClubWindow;
  mode: ModeSpec;
  endIndex: 0 | 1;
  /** Shared euro axis for the fee-vs-value bar, across both tables. */
  axisMax: number;
}) {
  const [open, setOpen] = useState(false);
  const end = mode.ends[endIndex];
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
          {/* The division, in the same micro-type the transfer rows use for a
              league. Text rather than a crest: twenty of the twenty-five
              leagues in a window have no logo of ours, and half the clubs on
              these tables play outside the big five — a badge only the usual
              suspects get would say "these ones matter" and nothing else. It
              wraps rather than squeezes, so a long name keeps its room. */}
          <span className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="max-w-full truncate text-sm font-bold text-text-primary">
              {c.club.name}
            </span>
            {c.club.league && (
              <span className="text-[10px] uppercase tracking-wide text-text-muted">
                {c.club.league}
              </span>
            )}
          </span>
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
  endIndex,
  axisMax,
}: {
  rows: ClubWindow[];
  mode: ModeSpec;
  /** Which end of the shared ranking to read — the second one reads it from the
   *  bottom. Same function the club-page badges call, so a club badged
   *  "Shopped best" is by construction the one at the head of this table. */
  endIndex: 0 | 1;
  axisMax: number;
}) {
  const top = useMemo(() => rankClubs(rows, mode, endIndex).slice(0, TOP), [rows, mode, endIndex]);

  if (top.length === 0) return <p className="text-sm text-text-muted">No clubs qualify.</p>;
  return (
    <ul className="space-y-2">
      {top.map((c) => (
        <li key={c.club.clubId || c.club.name}>
          <ClubRow c={c} mode={mode} endIndex={endIndex} axisMax={axisMax} />
        </li>
      ))}
    </ul>
  );
}

export function ClubTables({
  transfers,
  spec,
  league,
}: {
  transfers: PricedTransfer[];
  spec: ModeSpec;
  league: string;
}) {
  // Loans are a scope on the data rather than a different question, so the
  // control sits here beside the tables instead of competing with the mode
  // toggle above — but the choice itself lives in the URL like every other one
  // on this page, so a cut can be linked and an accolade badge can point at the
  // exact table its club won.
  const { params, replace } = useQueryParams(PATH);
  const cut = resolveLoans(params.get("loans"));
  // Aggregated here rather than on the server: both cuts are rearrangements of
  // the transfers the page already holds, and shipping them pre-built put every
  // move on the wire four more times.
  //
  // Built from every transfer, then narrowed to the chosen league by club.
  // Narrowing the moves first would restate each club's window as "the part of
  // it that touched this league" and print it under the same heading.
  const rows = useMemo(
    () =>
      buildClubWindows(cutTransfers(transfers, cut)).filter((c) => inLeague(c.club.league, league)),
    [transfers, cut, league],
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
          value={cut}
          onValueChange={(v) => v && replace({ loans: v === "permanent" ? "permanent" : null })}
          variant="outline"
          size="sm"
          className="rounded-lg"
          aria-label="Count loans"
        >
          <ToggleGroupItem value="loans" className="rounded-l-lg">
            With loans
          </ToggleGroupItem>
          <ToggleGroupItem value="permanent" className="rounded-r-lg">
            Permanent only
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {spec.ends.map((end, i) => (
          <SectionPanel key={end.title} title={end.title}>
            <ClubTable rows={rows} mode={spec} endIndex={i as 0 | 1} axisMax={axisMax} />
          </SectionPanel>
        ))}
      </div>
    </div>
  );
}
