import { Suspense } from "react";
import { getTransferBalance } from "@/lib/transfer-balance";
import { TransferBalanceUI } from "./TransferBalanceUI";
import { DataLastUpdated } from "@/app/components/DataLastUpdated";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Transfer Balance",
  description:
    "Transfer spending, sales income and net balance for every club on Transfermarkt, over one to four seasons. See which club tops the market on more than one measure.",
  path: "/transfer-balance",
  keywords: [
    "transfer spending by club",
    "net spend football",
    "transfer balance table",
    "biggest transfer spenders",
    "player sales income",
  ],
});

export default async function TransferBalancePage() {
  const data = await getTransferBalance();
  return (
    <>
      <Suspense>
        <TransferBalanceUI data={data} />
      </Suspense>
      <DataLastUpdated file="transfer-balance-updated-at.txt" />
    </>
  );
}
