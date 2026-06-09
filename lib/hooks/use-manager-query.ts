import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { ManagerInfo } from "@/app/types";

export function useManagerQuery(clubId: string) {
  return useQuery<ManagerInfo | null>({
    queryKey: ["manager", clubId],
    queryFn: () =>
      fetch(`/api/manager/${clubId}`)
        .then((r) => r.json())
        .then((d) => d.manager ?? null),
    staleTime: 86400_000,
  });
}

export const managerQueryOptions = (clubId: string) => ({
  queryKey: ["manager", clubId] as const,
  queryFn: () =>
    fetch(`/api/manager/${clubId}`)
      .then((r: Response) => r.json())
      .then((d: { manager?: ManagerInfo | null }) => d.manager ?? null),
  staleTime: 86400_000,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
});

/** Fetches managers for many clubs at once, returning a lookup map and a loading set. */
export function useManagersMap(clubIds: string[]) {
  const queries = useQueries({
    queries: clubIds.map((clubId) => managerQueryOptions(clubId)),
  });

  return useMemo(() => {
    const managersMap: Record<string, ManagerInfo | null> = {};
    const loadingSet = new Set<string>();
    queries.forEach((q, i) => {
      if (q.data !== undefined) managersMap[clubIds[i]] = q.data;
      if (q.isLoading) loadingSet.add(clubIds[i]);
    });
    return { managersMap, loadingSet };
  }, [queries, clubIds]);
}
