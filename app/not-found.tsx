import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const PAGES = [
  { title: "Recent Form", href: "/form" },
  { title: "Value vs Table", href: "/expected-position" },
  { title: "Player Explorer", href: "/players" },
  { title: "Over/Under", href: "/value-analysis" },
  { title: "Injury Impact", href: "/injured" },
  { title: "Biggest Movers", href: "/biggest-movers" },
  { title: "Club Transfers", href: "/club-transfers" },
];

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-text-muted">404</p>
      <h1 className="mt-3 text-3xl font-pixel text-text-primary sm:text-4xl">Page not found</h1>
      <p className="mt-3 max-w-md text-sm text-text-secondary">
        The page you&apos;re looking for doesn&apos;t exist. Try one of the pages below.
      </p>

      <div className="mt-8 grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
        {PAGES.map((d) => (
          <Link
            key={d.href}
            href={d.href}
            className="group flex items-center justify-between rounded-lg border border-border-subtle bg-elevated px-3 py-2 text-sm font-medium text-text-secondary transition-all duration-200 hover:-translate-y-px hover:border-border-medium hover:bg-card-hover hover:text-text-primary"
          >
            <span>{d.title}</span>
            <ArrowRight className="h-3.5 w-3.5 text-text-muted transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>

      <Button asChild className="mt-8">
        <Link href="/">Back to Home</Link>
      </Button>
    </div>
  );
}
