"use client";

import { useState } from "react";

/** Opponent club crest or national-team flag, falling back to a "?" chip when the
 *  logo is missing or fails to load (e.g. a national team with no club crest). */
export function TeamLogo({ src, alt }: { src?: string; alt?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-black/20 text-[10px] text-text-muted">
        ?
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt || ""}
      onError={() => setBroken(true)}
      className="h-7 w-7 shrink-0 rounded-lg bg-white object-contain p-0.5"
    />
  );
}
