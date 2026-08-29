import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-8 sm:space-y-10">
      <div className="space-y-6 sm:space-y-8">
        {/* The window summary that opens the page. */}
        <Skeleton className="h-44 w-full rounded-xl sm:h-40" />

        <section>
          <Skeleton className="h-9 w-72 rounded-lg sm:h-10" />
          {/* The heading, and the measure control that now sits beside it. */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-4 w-full max-w-md" />
            </div>
            <Skeleton className="h-8 w-44 shrink-0 rounded-lg" />
          </div>
          <div className="mt-3 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg sm:h-28" />
            ))}
          </div>
        </section>
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
