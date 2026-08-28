"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { SectionPanel } from "@/components/SectionPanel";
import { ClubLogo } from "@/components/ClubLogo";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { formatMarketValue, getPlayerDetailHref, getTeamDetailHref } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ClubPremium, FeeVsValueData } from "@/lib/fee-vs-value";
import { formatPremium, formatRatio } from "./TransferRow";
import type { TopTransfer } from "@/app/types";

const TOP = 5;

/** One arrival inside an expanded club: who, what he was worth, what he cost. */
function ArrivalRow({ t }: { t: TopTransfer }) {
  const premium = t.fee - t.marketValue;
  return (
    <li className="flex items-center gap-2 py-1.5">
      <PlayerAvatar imageUrl={t.imageUrl} name={t.name} className="size-6 rounded" />
      <Link
        href={getPlayerDetailHref(t.playerId)}
        className="min-w-0 flex-1 truncate text-xs font-bold text-text-primary hover:underline"
      >
        {t.name}
      </Link>
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
          premium > 0 ? "text-accent-cold" : "text-accent-hot",
        )}
      >
        {formatPremium(premium)}
      </span>
    </li>
  );
}

function ClubRow({ c, tone }: { c: ClubPremium; tone: "over" | "under" }) {
  const [open, setOpen] = useState(false);
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
            {formatMarketValue(c.fees)} on {c.signings} {c.signings === 1 ? "player" : "players"}
            {c.loans > 0 && (
              <span className="text-text-muted">
                {" "}
                · {c.loans} {c.loans === 1 ? "loan" : "loans"}
              </span>
            )}
            {c.frees > 0 && <span className="text-text-muted"> · {c.frees} free</span>}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span
            className={cn(
              "block font-value text-sm",
              tone === "over" ? "text-accent-cold" : "text-accent-hot",
            )}
          >
            {formatPremium(c.premium)}
          </span>
          <Badge variant="outline" className="mt-0.5 font-value">
            {formatRatio(c.ratio)}
          </Badge>
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <ul className="divide-y divide-border-subtle border-t border-border-subtle px-2.5">
          {c.arrivals.map((t) => (
            <ArrivalRow key={t.playerId} t={t} />
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

function ClubTable({ rows, tone }: { rows: ClubPremium[]; tone: "over" | "under" }) {
  if (rows.length === 0) return <p className="text-sm text-text-muted">No clubs qualify.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((c) => (
        <li key={c.club.clubId || c.club.name}>
          <ClubRow c={c} tone={tone} />
        </li>
      ))}
    </ul>
  );
}

export function ClubTables({
  clubs,
  withLoans,
}: {
  clubs: FeeVsValueData["clubs"];
  withLoans: boolean;
}) {
  const rows = withLoans ? clubs.withLoans : clubs.permanentOnly;
  const overpayers = rows.filter((c) => c.premium > 0).slice(0, TOP);
  // Sorted by premium descending, so the best bargains are at the far end.
  const bargainHunters = rows
    .filter((c) => c.premium < 0)
    .slice()
    .reverse()
    .slice(0, TOP);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <SectionPanel title="Clubs that paid over the odds">
        <ClubTable rows={overpayers} tone="over" />
      </SectionPanel>
      <SectionPanel title="Clubs that shopped best">
        <ClubTable rows={bargainHunters} tone="under" />
      </SectionPanel>
    </div>
  );
}
