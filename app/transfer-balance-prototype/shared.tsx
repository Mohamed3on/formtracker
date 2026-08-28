// PROTOTYPE — throwaway. Three variants of /transfer-balance, switchable via ?variant=.
// Question: what should the transfer-balance page look like? See PrototypeSwitcher.
import { crestUrl } from "@/lib/transfermarkt";

/** Football terms, not accountancy. The Net column reads like a bank balance:
 *  positive = the club banked money on transfers, negative = it spent money.
 *  A club's "net spend" is therefore the negative of its Net figure. */
export const METRICS = {
  expenditure: "Gross spend",
  income: "Sales",
  netSpender: "Biggest net spender",
  netProfit: "Biggest net profit",
} as const;

export type MetricKey = keyof typeof METRICS;

export interface Club {
  id: string;
  slug: string;
  name: string;
  expenditure: number;
  arrivals: number;
  income: number;
  departures: number;
  balance: number;
}

export interface Window {
  seasons: number;
  from: number;
  label: string;
  leaders: Record<MetricKey, { id: string; name: string; value: number }>;
  winners: { id: string; name: string; metrics: MetricKey[] }[];
  clubs: Club[];
  wins: Record<string, MetricKey[]>;
}

/** Sales minus spend: positive means the club came out ahead. */
export function net(c: Club): number {
  return c.balance;
}

/** Values arrive in millions of euros. */
export function money(m: number): string {
  const sign = m < 0 ? "−" : "";
  const abs = Math.abs(m);
  return abs >= 1000 ? `${sign}€${(abs / 1000).toFixed(2)}bn` : `${sign}€${abs.toFixed(2)}m`;
}

/** Down on transfers is red, up is green. NB --accent-hot is GREEN in this
 *  design system (#00ff87); --accent-cold is the red. */
export function netTone(value: number): string {
  return value < 0 ? "text-[var(--accent-cold)]" : "text-[var(--accent-green)]";
}

export function Crest({ club, size = "sm" }: { club: Club; size?: "sm" | "lg" }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={crestUrl(club.id)}
      alt=""
      loading="lazy"
      className={size === "lg" ? "size-8 shrink-0 object-contain" : "size-5 shrink-0 object-contain"}
    />
  );
}
