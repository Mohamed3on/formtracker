import type { MinutesValuePlayer } from "@/app/types";
import { getMinutesValueData } from "./fetch-minutes-value";

/**
 * Today's Transfermarkt market value for every player in the committed dataset,
 * by player id.
 *
 * Transfermarkt's transfer table carries the value a player held **at the time
 * of the move**. The two are used for different measures in `fee-vs-value`:
 *
 * - the **cash premium** stays on the frozen value, because whether a club paid
 *   over the odds can only be judged on what was known on the day;
 * - the **multiple** ("they paid 1.25× what he is worth") reads against this
 *   one, because that is a live question about the player, not a historical one
 *   about the deal.
 *
 * Two caveats that come with the multiple, both deliberate:
 *
 * 1. TM re-rates a player *towards* the fee his new club paid — four of this
 *    window's thirteen re-rated players landed on the fee exactly — so a
 *    multiple drifts towards 1.00× as the market comes round to the price. A
 *    deal stops looking like an overpay once the market agrees with it.
 * 2. Coverage is partial: the dataset tracks a pool of roughly 700 players,
 *    which caught 66% of this window's permanent signings. The rest fall back to
 *    the frozen value, so a times-value ranking mixes the two bases across rows.
 *
 * Memoised per process: committed data, read once, same as `linkable-nations`.
 */
let byPlayerId: Map<string, number> | null = null;

export async function getCurrentMarketValues(): Promise<ReadonlyMap<string, number>> {
  if (!byPlayerId) {
    const players: MinutesValuePlayer[] = await getMinutesValueData();
    byPlayerId = new Map(
      players.flatMap((p) =>
        p.playerId && p.marketValue > 0 ? [[p.playerId, p.marketValue]] : [],
      ),
    );
  }
  return byPlayerId;
}
