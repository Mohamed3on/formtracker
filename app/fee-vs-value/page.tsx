import { rank } from "@/lib/fee-vs-value";
import { getFeeVsValueData } from "@/lib/top-transfers";
import { createPageMetadata } from "@/lib/metadata";
import { Leaderboard } from "./Leaderboard";

export const metadata = createPageMetadata({
  title: "Fee vs Value",
  description:
    "Which clubs paid over the odds and which got a bargain in the season's 200 biggest transfers. Every fee held up against the player's Transfermarkt market value, in cash and times value.",
  path: "/fee-vs-value",
  keywords: [
    "most overpriced transfer",
    "transfer fee vs market value",
    "biggest transfer bargains",
    "overpaid football transfers",
    "transfer premium analysis",
  ],
});

export default async function FeeVsValuePage() {
  const data = await getFeeVsValueData();
  const ranked = rank(data.paid, data.free);

  return (
    <div className="space-y-8 sm:space-y-10">
      <Leaderboard ranked={ranked} clubs={data.clubs} />
      <section className="rounded-lg border border-border-subtle bg-card p-4">
        <h2 className="text-sm font-medium text-text-secondary">How to read this</h2>
        <p className="mt-2 text-sm text-text-muted">
          Every row is one of the {data.paid.length + data.free.length + data.loans.length} biggest
          transfers this season. Sort by <strong>cash</strong> to see how much more, or less, than
          his value a club paid. Sort by <strong>times value</strong> to see it as a multiplier:
          2.00× means they paid double, 0.50× means half price. Big transfers lead the cash list and
          small ones lead the times value list, so the two rarely name the same player.
        </p>
        <p className="mt-2 text-sm text-text-muted">
          A free transfer is still a signing, so it counts in the cash lists — picking up a €45M
          defender for nothing is the best bargain there is. It is left out of the times value
          lists, where every free comes to 0.00× and they would fill the top in a dead heat. A loan
          is not a signing at all, so it stays out of both — it only shows up in a club's totals,
          and only if you leave that switch on.
        </p>
      </section>
    </div>
  );
}
