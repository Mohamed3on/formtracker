import { createPageMetadata } from "@/lib/metadata";
import { WcBracket } from "./WcBracket";

export const metadata = {
  ...createPageMetadata({
    title: "World Cup 2026 — Market Value Simulation",
    description:
      "A deterministic World Cup 2026 where the higher squad market value wins every match. Full bracket, group tables, and where each team finishes vs its value rank.",
    path: "/wc",
  }),
  robots: { index: false, follow: false },
};

export default function WcPage() {
  return (
    <div className="py-6 sm:py-10">
      <WcBracket />
    </div>
  );
}
