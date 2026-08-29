import { formatMarketValue } from "@/lib/format";
import { barGeometry, type PricedTransfer } from "@/lib/fee-vs-value";
import { cn } from "@/lib/utils";

/** The page's one mark, and the reason the page exists: the arrow between what a
 *  player is worth and what he cost, drawn to scale.
 *
 *  Three things sit on a shared euro axis. A neutral tick at his worth is the
 *  baseline both of the row's figures are measured from. A bar runs from that
 *  tick to the fee — its length is the premium, its colour the direction, red
 *  for over the odds and green for under. A pale dot marks what he was valued
 *  at on the day he moved, on the rows the market has re-rated since; where
 *  that dot sits away from the tick, the market has moved on the player.
 *
 *  A deal priced at exactly what the player is worth has its worth and its fee
 *  in the same place, so its bar collapses to a neutral mark on the tick — the
 *  same thing its figures say, €0 and 1.00× together.
 *
 *  Every row shares one axis, so bar lengths compare across the whole page.
 *
 *  The percentages arrive as custom properties rather than classes because they
 *  are data — there is no Tailwind class for "63.4% of the way along". Every
 *  actual style stays in a class and reads the property, which is the same
 *  arrangement the injury bars use. */
/** The "valued at, on the day" marker, defined once so the glyph beside the
 *  figure and the mark on the bar are visibly the same thing. */
export function WasWorthMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("size-2 shrink-0 rotate-45 bg-text-primary ring-2 ring-elevated", className)}
    />
  );
}

export function GapTrack({
  worthPct,
  feePct,
  wasPct,
  animate,
  className,
}: {
  worthPct: number;
  feePct: number;
  wasPct?: number | null;
  /** Grow the bar in. Worth it on the one summary bar; noise on 174 rows that
   *  would replay it every time the virtualiser scrolls one back into view. */
  animate?: boolean;
  className?: string;
}) {
  const gap = feePct - worthPct;
  // Deals priced at exactly what the player is worth are common enough to need
  // their own colour: neither hue, because the club neither overpaid nor got a
  // bargain. Painting them green read as a bargain that isn't there.
  const level = Math.abs(gap) < 0.01;
  const left = Math.min(worthPct, feePct);
  // A floor rather than zero, so a level deal collapses to a mark on the tick
  // instead of vanishing and reading as a rendering failure.
  const width = Math.max(Math.abs(gap), 0.5);

  return (
    // A span, not a div: club rows render this inside their collapsible
    // trigger, and a div is not valid inside a button.
    <span
      aria-hidden
      className={cn("relative block h-3", className)}
      style={
        {
          "--worth-x": `${worthPct}%`,
          "--bar-left": `${left}%`,
          "--bar-width": `${width}%`,
          "--was-x": `${wasPct ?? 0}%`,
        } as React.CSSProperties
      }
    >
      {/* The axis. Hairline, solid, one step off the surface. */}
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border-subtle" />
      {/* The gap. Square where it leaves the value, rounded at the fee. */}
      <span
        className={cn(
          "absolute top-1/2 h-1.5 -translate-y-1/2 left-[var(--bar-left)] w-[var(--bar-width)]",
          level
            ? "rounded-sm bg-text-secondary"
            : gap > 0
              ? "rounded-r-sm bg-accent-cold"
              : "rounded-l-sm bg-accent-hot",
          animate && "animate-bar-fill",
        )}
      />
      {/* What he is worth — the baseline the row's two figures share. */}
      <span className="absolute top-0 h-3 w-0.5 -translate-x-1/2 rounded-full bg-text-secondary left-[var(--worth-x)]" />
      {/* What he was valued at on the day, where the market has moved since. A
          diamond rather than a dot on purpose: a round handle sitting on a rail
          reads as a slider you are meant to drag. */}
      {wasPct != null && (
        <WasWorthMark className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 left-[var(--was-x)]" />
      )}
    </span>
  );
}

/** The mark with its two figures at the ends — the row-level instance.
 *
 *  Wraps below `sm`, where the track takes a line of its own rather than being
 *  squeezed to nothing between two euro figures on a 320px screen. */
export function FeeValueBar({
  transfer,
  axisMax,
  className,
}: {
  transfer: PricedTransfer;
  axisMax: number;
  className?: string;
}) {
  const geometry = barGeometry(
    {
      worth: transfer.worth,
      fee: transfer.fee,
      // Only a mark when it says something the worth doesn't.
      wasWorth: transfer.currentValue ? transfer.marketValue : undefined,
    },
    axisMax,
  );
  const paid = transfer.fee > 0 ? formatMarketValue(transfer.fee) : transfer.feeText || "free";

  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      <span className="order-1 text-xs text-text-secondary">
        <span className="mr-1 text-[10px] uppercase tracking-wider text-text-muted">Worth</span>
        <span className="font-value">{formatMarketValue(transfer.worth)}</span>
      </span>
      <span className="order-2 ml-auto text-xs text-text-primary sm:order-3 sm:ml-0">
        <span className="mr-1 text-[10px] uppercase tracking-wider text-text-muted">Fee</span>
        <span className="font-value">{paid}</span>
      </span>
      <GapTrack {...geometry} className="order-3 w-full sm:order-2 sm:w-auto sm:flex-1" />
    </div>
  );
}
