"use client";

import { useState } from "react";
import Link from "next/link";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { SectionPanel } from "@/components/SectionPanel";
import { ClubLogo } from "@/components/ClubLogo";
import { formatMarketValue, getTeamDetailHref } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ClubPremium, FeeVsValueData } from "@/lib/fee-vs-value";
import { formatPremium, formatRatio } from "./TransferRow";

const TOP = 5;

function ClubTable({ rows, tone }: { rows: ClubPremium[]; tone: "over" | "under" }) {
  if (rows.length === 0) return <p className="text-sm text-text-muted">No clubs qualify.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((c) => (
        <li
          key={c.club.clubId || c.club.name}
          className="flex items-center gap-3 rounded-lg border border-border-subtle bg-card p-2.5"
        >
          {c.club.logoUrl && <ClubLogo src={c.club.logoUrl} />}
          <div className="min-w-0 flex-1">
            {c.club.clubId ? (
              <Link
                href={getTeamDetailHref(c.club.clubId)}
                className="truncate text-sm font-bold text-text-primary hover:underline"
              >
                {c.club.name}
              </Link>
            ) : (
              <span className="truncate text-sm font-bold text-text-primary">{c.club.name}</span>
            )}
            <p className="mt-0.5 font-value text-xs text-text-secondary">
              {formatMarketValue(c.fees)} on {c.signings} {c.signings === 1 ? "player" : "players"}
              {c.loans > 0 && (
                <span className="text-text-muted">
                  {" "}
                  · {c.loans} {c.loans === 1 ? "loan" : "loans"}
                </span>
              )}
              {c.frees > 0 && <span className="text-text-muted"> · {c.frees} free</span>}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p
              className={cn(
                "font-value text-sm",
                tone === "over" ? "text-accent-cold" : "text-accent-hot",
              )}
            >
              {formatPremium(c.premium)}
            </p>
            <Badge variant="outline" className="mt-0.5 font-value">
              {formatRatio(c.ratio)}
            </Badge>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ClubTables({ clubs }: { clubs: FeeVsValueData["clubs"] }) {
  const [withLoans, setWithLoans] = useState(true);
  const rows = withLoans ? clubs.withLoans : clubs.permanentOnly;

  const overpayers = rows.filter((c) => c.premium > 0).slice(0, TOP);
  // Sorted by premium descending, so the best bargains are at the far end.
  const bargainHunters = rows
    .filter((c) => c.premium < 0)
    .slice()
    .reverse()
    .slice(0, TOP);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-xl text-sm text-text-muted">
          What a club ended up with, and what it paid. A loan brings in a player for little or
          nothing, which flatters the numbers — so you can leave loans out.
        </p>
        <ToggleGroup
          type="single"
          value={withLoans ? "with" : "without"}
          onValueChange={(v) => v && setWithLoans(v === "with")}
          variant="outline"
          size="sm"
          className="shrink-0 rounded-lg"
          aria-label="Count loans"
        >
          <ToggleGroupItem value="with" className="rounded-l-lg">
            With loans
          </ToggleGroupItem>
          <ToggleGroupItem value="without" className="rounded-r-lg">
            Signings only
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionPanel title="Clubs that paid over the odds">
          <ClubTable rows={overpayers} tone="over" />
        </SectionPanel>
        <SectionPanel title="Clubs that shopped best">
          <ClubTable rows={bargainHunters} tone="under" />
        </SectionPanel>
      </div>
    </div>
  );
}
