import type { MinutesValuePlayer } from "@/app/types";
import { getMinutesValueData } from "./fetch-minutes-value";

/**
 * Today's Transfermarkt market value for every player in the committed dataset,
 * by player id.
 *
 * Transfermarkt's transfer table carries the value a player held **at the time
 * of the move**. Where this map has him, the value here wins: it becomes the
 * `worth` in `fee-vs-value`, and the cash premium and the multiple are both
 * measured from it. One basis, not two — pricing the gap in euros against the
 * frozen value while pricing it as a multiple against today's put `+€48.0M`
 * beside `1.25×` on the same row, which reads as one of them being broken.
 *
 * The frozen figure is still shown, as the mark on the bar and the "was worth"
 * line beside the row, so a re-rated deal says both things at once.
 *
 * Two caveats that come with measuring against today, both deliberate:
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
