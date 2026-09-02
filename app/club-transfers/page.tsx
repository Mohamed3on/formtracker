import { getFeeVsValueData } from "@/lib/top-transfers";
import { getTransferBalance } from "@/lib/transfer-balance";
import { createPageMetadata } from "@/lib/metadata";
import { CLUB_PATH } from "@/lib/fee-vs-value-rankings";
import { DataLastUpdated } from "@/app/components/DataLastUpdated";
import { ClubTransfersUI } from "./ClubTransfersUI";

export const metadata = createPageMetadata({
  title: "Club Transfers",
  description:
    "Every club's transfer window, judged: fees held against what the players were worth, buying and selling side by side, and who came out of the window ahead. Plus spending, sales and net balance for the world's biggest movers over one to four seasons.",
  path: CLUB_PATH,
  keywords: [
    "transfer spending by club",
    "net spend football",
    "best transfer window",
    "who won the transfer window",
    "transfer balance table",
    "biggest transfer spenders",
    "player sales income",
  ],
});

/** Which ranking, which end of it and which cut are on screen live in the
 *  query string, so a view can be linked and a club's badge can land on the
 *  exact table it heads. Rendering per request puts the chosen view in the
 *  first HTML; the scrape behind it keeps its own 24-hour cache. */
export const dynamic = "force-dynamic";

export default async function ClubTransfersPage() {
  const [data, balance] = await Promise.all([getFeeVsValueData(), getTransferBalance()]);

  return (
    <>
      <ClubTransfersUI transfers={data.transfers} balance={balance} season={data.season} />
      <DataLastUpdated file="transfer-balance-updated-at.txt" />
    </>
  );
}
