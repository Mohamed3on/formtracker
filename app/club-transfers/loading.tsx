import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function Cards({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="space-y-2 p-3 sm:p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-3 w-36" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Loading() {
  return (
    <div className="space-y-8 sm:space-y-10">
      {/* The overview: best business, worst business, the money. */}
      <div className="space-y-6">
        {["Best business", "Worst business", "Biggest money"].map((title, i) => (
          <section key={title}>
            <Skeleton className="h-4 w-28" />
            <div className="mt-3">
              <Cards count={i === 2 ? 4 : 5} />
            </div>
          </section>
        ))}
      </div>

      {/* The heading, the controls beside it, and the ledger. */}
      <section>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-full max-w-lg" />
          </div>
          <Skeleton className="h-8 w-80 shrink-0 rounded-lg" />
        </div>
        <div className="mt-4 space-y-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </section>
    </div>
  );
}
