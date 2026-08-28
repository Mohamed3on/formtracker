import { getFeeVsValueData } from "@/lib/top-transfers";

export default async function FeeVsValueLayout({ children }: { children: React.ReactNode }) {
  // Same React-cached read as the page, so the count in the blurb is whatever
  // was actually scraped rather than a number that drifts when the limit moves.
  const { paid, free, loans } = await getFeeVsValueData();
  const total = paid.length + free.length + loans.length;

  return (
    <div className="py-4 sm:py-8">
      <div className="mb-4 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-pixel mb-1 sm:mb-2 text-text-primary">
          Fee vs Value
        </h1>
        <p className="text-sm sm:text-base text-text-muted max-w-2xl">
          The {total} biggest transfers of the season. For each one we put the fee next to what the
          player was worth. Who paid too much, and who got a bargain.
        </p>
      </div>
      {children}
    </div>
  );
}
