import { formatMarketValue, formatPremium, formatRatio } from "@/lib/format";
import { barGeometry, type WindowSummary as Summary } from "@/lib/fee-vs-value";
import { cn } from "@/lib/utils";
import { GapTrack, WasWorthMark } from "./FeeValueBar";

/** TM keys a season by its starting year. */
function seasonLabel(season: number) {
  return `${season}/${String((season + 1) % 100).padStart(2, "0")}`;
}

/** One end of the over/at/under split, which doubles as the colour key for
 *  every bar below it — the legend a reader would otherwise have to infer. */
function Split({ swatch, count, label }: { swatch: string; count: number; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={cn("h-1.5 w-4 shrink-0 rounded-full", swatch)} />
      <span className="font-value text-text-primary">{count}</span>
      <span className="text-text-muted">{label}</span>
    </span>
  );
}

/**
 * What the whole window says, before any of the rankings narrow it down.
 *
 * The page used to open straight onto 174 rows with no sense of scale, so the
 * one number it is sitting on — the market paid a tenth more than the players
 * were worth — went unsaid. It is stated here in words, then drawn with the
 * same mark every row below uses, which is what saves the rows from needing a
 * legend of their own: read this once and every bar on the page is readable.
 */
export function WindowSummary({ season, summary }: { season: number; summary: Summary }) {
  const geometry = barGeometry(
    { worth: summary.marketValue, fee: summary.fees },
    Math.max(summary.fees, summary.marketValue),
  );
  const over = summary.premium > 0;
  // Named separately: a loan was never a signing, an unpriced row is one TM gave
  // no fee or no value for. Lumping them would imply the page had ignored deals
  // it could have judged.
  const excluded = [
    { count: summary.loans, label: summary.loans === 1 ? "loan" : "loans" },
    { count: summary.unpriced, label: "unpriced" },
  ].filter((e) => e.count > 0);

  return (
    <section className="rounded-xl border border-border-subtle bg-elevated p-4 sm:p-5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted">
        {seasonLabel(season)} window · <span className="font-value">{summary.deals}</span> permanent
        signings priced
      </p>

      <p className="mt-2 text-base leading-snug text-text-primary sm:text-xl">
        Clubs paid <span className="font-value">{formatMarketValue(summary.fees)}</span> for{" "}
        <span className="font-value">{formatMarketValue(summary.marketValue)}</span> of players —{" "}
        <span className={cn("font-value", over ? "text-accent-cold" : "text-accent-hot")}>
          {formatPremium(summary.premium)}
        </span>{" "}
        {over ? "over the odds" : "under the odds"}, or{" "}
        <span className="font-value">{formatRatio(summary.ratio)}</span> what they were worth.
      </p>

      {/* The same mark the rows use, at window scale and labelled once. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="order-1">
          <span className="block text-[10px] uppercase tracking-wider text-text-muted">Worth</span>
          <span className="block font-value text-sm text-text-secondary">
            {formatMarketValue(summary.marketValue)}
          </span>
        </span>
        <span className="order-2 ml-auto text-right sm:order-3 sm:ml-0 sm:text-left">
          <span className="block text-[10px] uppercase tracking-wider text-text-muted">
            Fees paid
          </span>
          <span className="block font-value text-sm text-text-primary">
            {formatMarketValue(summary.fees)}
          </span>
        </span>
        <GapTrack {...geometry} animate className="order-3 w-full sm:order-2 sm:w-auto sm:flex-1" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border-subtle pt-3 text-xs">
        <Split swatch="bg-accent-cold" count={summary.over} label="paid over value" />
        <Split swatch="bg-text-secondary" count={summary.level} label="paid exactly value" />
        <Split swatch="bg-accent-hot" count={summary.under} label="paid under value" />
        {/* Everything the pool left out, named. A count that silently swallowed
            the rows it dropped would send the reader off to check it. */}
        {excluded.map(({ count, label }) => (
          <span key={label} className="text-text-muted">
            <span className="font-value">{count}</span> {label} excluded
          </span>
        ))}
      </div>

      {summary.revalued > 0 && (
        <p className="mt-2 text-xs text-text-secondary">
          <WasWorthMark className="mr-1.5 inline-block align-middle" />
          Transfermarkt has re-rated <span className="font-value">{summary.revalued}</span> of them
          since —{" "}
          {summary.revaluedUp === summary.revalued ? (
            <>every one upwards</>
          ) : (
            <>
              <span className="font-value">{summary.revaluedUp}</span> upwards
            </>
          )}
          , and <span className="font-value">{summary.worthTheFee}</span> are now worth at least
          what they cost.
        </p>
      )}
    </section>
  );
}
