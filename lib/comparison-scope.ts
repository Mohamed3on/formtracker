export type ComparisonScope = "all" | "league" | "sameOrStronger";

// Default scope is "same or stronger league" — absence of params means that, and "all" is opted into explicitly.
export function paramsToScope(params: {
  sameLeague?: string | null;
  allLeagues?: string | null;
}): ComparisonScope {
  if (params.sameLeague === "1") return "league";
  if (params.allLeagues === "1") return "all";
  return "sameOrStronger";
}

export function scopeToParams(scope: ComparisonScope): {
  sameLeague: string | null;
  allLeagues: string | null;
} {
  return {
    sameLeague: scope === "league" ? "1" : null,
    allLeagues: scope === "all" ? "1" : null,
  };
}
