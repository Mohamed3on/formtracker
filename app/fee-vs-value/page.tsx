import { TOP_TRANSFER_LIMIT } from "@/lib/fetch-top-transfers";
import { getFeeVsValueData } from "@/lib/top-transfers";
import { createPageMetadata } from "@/lib/metadata";
import { Leaderboard } from "./Leaderboard";

export const metadata = createPageMetadata({
  title: "Fee vs Value",
  description: `Which clubs paid over the odds and which got a bargain in the season's ${TOP_TRANSFER_LIMIT} biggest transfers. Every fee held up against the player's Transfermarkt market value, in cash and times value.`,
  path: "/fee-vs-value",
  keywords: [
    "most overpriced transfer",
    "transfer fee vs market value",
    "biggest transfer bargains",
    "overpaid football transfers",
    "transfer premium analysis",
  ],
});

/** Which tab and measure are on screen lives in the query string, so a view can
 *  be linked, opened in a new tab and walked with the back button. That makes
 *  the route depend on the request, and rendering it per request is what puts
 *  the *chosen* tab in the first HTML rather than the default one. The scrape
 *  behind it stays on its own 24-hour cache, so this costs a render, not a
 *  fetch. */
export const dynamic = "force-dynamic";

export default async function FeeVsValuePage() {
  const data = await getFeeVsValueData();

  return (
    <div className="space-y-8 sm:space-y-10">
      <Leaderboard transfers={data.transfers} />

      <section className="rounded-lg border border-border-subtle bg-card p-4">
        <h2 className="text-sm font-medium text-text-secondary">How to read this</h2>
        <p className="mt-2 text-sm text-text-muted">
          Every row draws its deal. A pale tick marks what the player is worth, a bar runs from
          there to what he cost, and its colour is the direction — red for over the odds, green for
          under. Every bar on the page shares one scale, which is why the cash lists open with long
          bars and the times value lists open with short ones: the biggest multiples of a window
          belong to small transfers, so the two lists rarely name the same player.
        </p>
        <p className="mt-2 text-sm text-text-muted">
          Both figures are measured against the same value, so they always agree —{" "}
          <strong>cash</strong> is the gap in euros and <strong>times value</strong> is that same
          gap as a multiple, where <span className="font-value">2.00×</span> means they paid double
          and <span className="font-value">0.50×</span> means half price. That value is what the
          player is worth <em>today</em> wherever Transfermarkt has re-rated him since the move, and
          what he was worth on the day everywhere else. The frozen figure is kept on those rows
          either way: a white dot on the bar marks what he was valued at when he moved, with the
          number printed beside it. A deal the market has come round to reads{" "}
          <span className="font-value">€0</span> and <span className="font-value">1.00×</span>{" "}
          together, and its bar collapses to a single grey mark.
        </p>
        <p className="mt-2 text-sm text-text-muted">
          Every row is one of the <span className="font-value">{data.transfers.length}</span>{" "}
          biggest transfers this season. A free transfer is still a signing, so it counts in the
          cash lists — picking up a <span className="font-value">€45M</span> defender for nothing is
          the best bargain there is. It is left out of the times value lists, where every free comes
          to <span className="font-value">0.00×</span> and they would fill the top in a dead heat. A
          loan is not a signing at all, so it stays out of both — it only shows up under{" "}
          <strong>Clubs</strong>, and only with that switch on.
        </p>
        <p className="mt-2 text-sm text-text-muted">
          The league filter takes a deal if <em>either</em> club is in that league, because most of
          the divisions here appear only as sellers — filtering on the buyer alone would empty them.
          So picking Liga Portugal keeps a Sporting player&apos;s move to the Premier League, and
          picking the Premier League keeps it too. Under <strong>Clubs</strong> it means the club
          itself, and each club keeps its whole window rather than the part of it that touched the
          league you picked.
        </p>
        <p className="mt-2 text-sm text-text-muted">
          Every row names the club a player left as well as the one he joined, and the leagues
          behind them when he is changing division. That lets <strong>Clubs</strong> read the same
          window from either end. <strong>Buying</strong> is fees paid against what the players were
          worth; <strong>Selling</strong> is fees banked against what the players leaving were
          worth, where being above value is the good outcome rather than the bad one.{" "}
          <strong>Squad value</strong> sets the two against each other — value in minus value out —
          so it names who came out of the window stronger rather than who simply churned the most.
          Open any club to see the deals behind its total.
        </p>
      </section>
    </div>
  );
}
