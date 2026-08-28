// PROTOTYPE — throwaway route. Three variants of the future /transfer-balance page,
// switchable via ?variant=A|B|C. Real Transfermarkt data, frozen into fixture.json.
// Delete this whole directory (and app/components/PrototypeSwitcher.tsx) once a variant wins.
import { Suspense } from "react";
import { PrototypeSwitcher } from "@/app/components/PrototypeSwitcher";
import { VariantA } from "./VariantA";
import { VariantB } from "./VariantB";
import { VariantC } from "./VariantC";
import fixture from "./fixture.json";
import type { Window } from "./shared";

const NAMES = { A: "Leaders first", B: "Dense ledger", C: "Ladder spine" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  const { variant = "A" } = await searchParams;
  const windows = fixture.windows as unknown as Window[];

  return (
    <div className="py-4 sm:py-8">
      <div className="mb-4 sm:mb-8">
        <h1 className="font-pixel mb-1 text-2xl text-[var(--text-primary)] sm:mb-2 sm:text-3xl">
          Transfer Balance
        </h1>
        <p className="max-w-xl text-sm text-[var(--text-muted)] sm:text-base">
          Who spent, who sold, and who came out ahead — across every club on Transfermarkt.
        </p>
      </div>
      {variant === "A" && <VariantA windows={windows} />}
      {variant === "B" && <VariantB windows={windows} />}
      {variant === "C" && <VariantC windows={windows} />}
      <Suspense>
        <PrototypeSwitcher variants={["A", "B", "C"]} names={NAMES} />
      </Suspense>
    </div>
  );
}
