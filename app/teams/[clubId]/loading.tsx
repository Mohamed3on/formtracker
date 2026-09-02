import { Skeleton } from "@/components/ui/skeleton";
import { DetailHeroSkeleton, DetailPageShellSkeleton } from "@/components/DetailHero";

export default function TeamDetailLoading() {
  return (
    <DetailPageShellSkeleton>
      <DetailHeroSkeleton>
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <Skeleton className="h-24 w-24 shrink-0 rounded-[1.5rem]" />
            <div className="flex-1 space-y-3">
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-28 rounded-full" />
              </div>
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-3 w-72" />
              <div className="flex gap-3">
                <Skeleton className="h-9 w-32" />
                <Skeleton className="h-9 w-28" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-3 w-28" />
            </div>
          ))}
        </div>
      </DetailHeroSkeleton>

      <div className="mt-8 overflow-hidden rounded-2xl border border-border-subtle bg-card">
        <div className="px-5 py-4 sm:px-6">
          <div className="flex gap-1">
            <Skeleton className="h-9 w-20 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-3">
          <Skeleton className="h-8 w-56 rounded-lg" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </DetailPageShellSkeleton>
  );
}
