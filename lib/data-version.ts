import { readFile } from "fs/promises";
import { join } from "path";
import { cache } from "react";

/**
 * Cache-key version for anything computed from the committed data/*.json files.
 * unstable_cache entries survive deployments, so after a data-refresh deploy the
 * previous deploy's computation would keep being served until its TTL lapsed.
 * Keying by the refresh timestamps makes each data deploy miss cleanly.
 */
export const getDataVersion = cache(async (): Promise<string> => {
  const stamp = (file: string) =>
    readFile(join(process.cwd(), "data", file), "utf-8").then(
      (value) => value.trim(),
      () => "",
    );
  const [minutesValue, movers] = await Promise.all([
    stamp("updated-at.txt"),
    stamp("biggest-movers-updated-at.txt"),
  ]);
  return `${minutesValue}|${movers}`;
});
