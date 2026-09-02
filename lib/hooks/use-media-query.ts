"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether a media query matches, tracking the viewport from then on.
 *
 * `false` on the server and through hydration, so the first client render
 * agrees with the HTML it is hydrating; the real answer follows in the same
 * pass React reserves for exactly this. Reading `window` in a state
 * initialiser instead painted one answer on the server and another on the
 * client, which React reports as a hydration mismatch and repairs by throwing
 * the whole subtree away.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
