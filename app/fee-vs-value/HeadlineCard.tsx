import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ClubLogo } from "@/components/ClubLogo";
import { getPlayerDetailHref } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PricedTransfer } from "@/lib/fee-vs-value";
import { formatPremium, formatRatio, ValueToFee } from "./TransferRow";

/** One of the answers the page exists to give: the extreme of overpay or
 *  bargain, in cash, times value, or — when one deal tops both — the pair.
 *
 *  Cash and times value usually crown different players, which is the point of
 *  showing both. When they don't, two identical cards read as a rendering bug
 *  rather than as the finding it actually is, so the card takes both figures
 *  and says so. */
export function HeadlineCard({
  label,
  hint,
  transfer,
  metrics,
  tone,
  className,
}: {
  label: string;
  hint: string;
  transfer: PricedTransfer | undefined;
  /** Figures to show, largest first. Two means one deal won both measures. */
  metrics: Array<"premium" | "ratio">;
  tone: "over" | "under";
  className?: string;
}) {
  if (!transfer) return null;
  const over = tone === "over";
  const accent = over ? "text-accent-cold" : "text-accent-hot";
  const figure = (basis: "premium" | "ratio") =>
    basis === "premium" ? formatPremium(transfer.premium) : formatRatio(transfer.ratio);

  return (
    <Card
      className={cn("border-l-2", over ? "border-l-accent-cold" : "border-l-accent-hot", className)}
    >
      <CardContent className="p-3 sm:p-4">
        <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{label}</p>

        <div className="mt-2.5 flex items-center gap-3">
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
                {figure(basis)}
              </p>
            ))}
          </div>
        </div>

        <p className="mt-2.5 text-xs text-text-muted">{hint}</p>
      </CardContent>
    </Card>
  );
}
