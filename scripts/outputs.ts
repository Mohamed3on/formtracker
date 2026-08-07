/** The commit-set of each refresh flow — the single list ci-push receives.
 *  Everything a refresh script writes under data/ that must survive the run
 *  belongs here. The workflow shells out to this file (`bun run
 *  scripts/outputs.ts <flow>`), so the committed list can't drift from the
 *  script's write-set — the drift already cost five weeks of silently
 *  discarded clubs.json / club-types.json updates. */
export const REFRESH_OUTPUTS = {
  "minutes-value": [
    "data/minutes-value.json",
    "data/updated-at.txt",
    "data/player-pool-mv.json",
    "data/player-pool-mv-updated-at.txt",
    "data/player-pool-scorers.json",
    "data/season.txt",
    "data/clubs.json",
    "data/club-types.json",
  ],
  "biggest-movers": [
    "data/biggest-winners.json",
    "data/biggest-losers.json",
    "data/biggest-movers-updated-at.txt",
  ],
} as const;

if (import.meta.main) {
  const key = process.argv[2] as keyof typeof REFRESH_OUTPUTS;
  const files = REFRESH_OUTPUTS[key];
  if (!files) {
    console.error(`Unknown refresh flow: ${process.argv[2]}`);
    process.exit(1);
  }
  console.log(files.join(" "));
}
