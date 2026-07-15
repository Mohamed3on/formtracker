export type ComparisonScope = "all" | "league" | "sameOrStronger" | "top5";

// Default scope is "same or stronger league" — absence of params means that, and the rest are opted into explicitly.
export function paramsToScope(params: {
  sameLeague?: string | null;
  allLeagues?: string | null;
  top5?: string | null;
}): ComparisonScope {
  if (params.sameLeague === "1") return "league";
  if (params.allLeagues === "1") return "all";
  if (params.top5 === "1") return "top5";
  return "sameOrStronger";
}

export function scopeToParams(scope: ComparisonScope): {
  sameLeague: string | null;
  allLeagues: string | null;
  top5: string | null;
} {
  return {
    sameLeague: scope === "league" ? "1" : null,
    allLeagues: scope === "all" ? "1" : null,
    top5: scope === "top5" ? "1" : null,
  };
}
