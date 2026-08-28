import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ClubLogo } from "@/components/ClubLogo";
import { getPlayerDetailHref } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PricedTransfer } from "@/lib/fee-vs-value";
import { formatPremium, formatRatio, ValueToFee } from "./TransferRow";

type Basis = "premium" | "ratio";

/** One of the answers the page exists to give: the extreme of overpay or
 *  bargain, in cash, times value, or — when one deal tops both — the pair.
 *
 *  Takes a list, not a winner. Two deals landing the same distance from value
 *  are joint leaders and both get named; picking one on sort order would just
 *  be hiding the more interesting fact. */
export function HeadlineCard({
  label,
  hint,
  transfers,
  metrics,
  tone,
  className,
}: {
  label: string;
  hint: string;
  transfers: PricedTransfer[];
  /** Figures to show per deal, largest first. Two means one deal won both. */
  metrics: Basis[];
  tone: "over" | "under";
  className?: string;
}) {
  if (!transfers.length) return null;
  const over = tone === "over";
  const accent = over ? "text-accent-cold" : "text-accent-hot";

  return (
    <Card
      className={cn("border-l-2", over ? "border-l-accent-cold" : "border-l-accent-hot", className)}
    >
      <CardContent className="p-3 sm:p-4">
        <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted">
          {label}
          {transfers.length > 1 && (
            <span className="ml-2 text-text-secondary">joint · {transfers.length} deals</span>
          )}
        </p>

        <ul className="mt-2.5 space-y-2.5">
          {transfers.map((transfer) => (
            <li key={transfer.playerId} className="flex items-center gap-3">
              <PlayerAvatar imageUrl={transfer.imageUrl} name={transfer.name} size="md" />
              <div className="min-w-0 flex-1">
                <Link
                  href={getPlayerDetailHref(transfer.playerId)}
                  className="block truncate text-base font-bold text-text-primary hover:underline"
                >
                  {transfer.name}
                </Link>
                <div className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-text-secondary">
                  {transfer.to.logoUrl && <ClubLogo src={transfer.to.logoUrl} />}
                  <span className="truncate">{transfer.to.name}</span>
                </div>
                <div className="mt-1">
                  <ValueToFee transfer={transfer} />
                </div>
              </div>

              <div className="flex shrink-0 items-baseline gap-2.5">
                {metrics.map((basis, i) => (
                  <p
                    key={basis}
                    className={cn(
                      "font-value leading-none",
                      accent,
                      i === 0 ? "text-xl sm:text-2xl" : "text-base opacity-70 sm:text-lg",
                    )}
                  >
                    {basis === "premium"
                      ? formatPremium(transfer.premium)
                      : formatRatio(transfer.ratio)}
                  </p>
                ))}
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-2.5 text-xs text-text-muted">{hint}</p>
      </CardContent>
    </Card>
  );
}
