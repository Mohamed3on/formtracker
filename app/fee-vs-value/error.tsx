"use client";

import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** The scrape now insists on a complete set of pages rather than caching a
 *  partial one for the day (see lib/fetch-top-transfers.ts), so a bad run
 *  surfaces here instead of quietly serving a list with a hole in it. */
export default function FeeVsValueError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-text-muted">
        Transfer data unavailable
      </p>
      <h1 className="mt-3 text-3xl font-pixel text-text-primary sm:text-4xl">
        Couldn&apos;t load the season&apos;s transfers
      </h1>
      <p className="mt-3 max-w-md text-sm text-text-secondary">
        Transfermarkt didn&apos;t return every page this time, and half a table would rank the wrong
        deals. This usually clears up in a minute — try again.
      </p>

      <Button onClick={reset} className="mt-8">
        <RefreshCcw className="h-4 w-4" />
        Try again
      </Button>
    </div>
  );
}
