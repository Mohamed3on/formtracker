"use client";

import { useState, type ComponentProps } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetClose } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Menu, HelpCircle, ChevronDown } from "lucide-react";
import { PlayerSearch } from "./PlayerSearch";
import { LEAGUES, getLeagueLogoUrl } from "@/lib/leagues";

const PAGE_CACHE_MAP: Record<string, { tags?: string[]; workflow?: boolean }> = {
  "/form": { tags: ["form-analysis", "manager"] },
  "/expected-position": { tags: ["team-form", "manager"] },
  "/injured": { tags: ["injured"] },
  "/players": { workflow: true },
  "/value-analysis": { workflow: true },
  "/biggest-movers": { workflow: true },
  "/fee-vs-value": { tags: ["top-transfers"] },
};

async function refreshPage(pathname: string) {
  const config = PAGE_CACHE_MAP[pathname];
  const fetches: Promise<Response>[] = [];

  if (!config || config.tags) {
    fetches.push(
      fetch("/api/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: config?.tags, path: pathname }),
      }),
    );
  }

  if (!config || config.workflow) {
    fetches.push(fetch("/api/refresh-data", { method: "POST" }));
  }

  const results = await Promise.all(fetches);
  const failures = results.filter((res) => !res.ok);
  if (failures.length > 0) {
    for (const res of failures) console.error(`[refresh] ${res.url} returned ${res.status}`);
    throw new Error("Refresh failed");
  }
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

const navItems = [
  { href: "/", label: "Home", desktopHidden: true },
  { href: "/form", label: "Recent Form" },
  { href: "/expected-position", label: "Value vs Table" },
  { href: "/players", label: "Players" },
  // Grouped, not top-level: an eighth desktop nav item overflows the bar into
  // the logo at the xl breakpoint, which is exactly where the bar first appears.
  {
    href: "/value-analysis",
    label: "Over/Under",
    children: [
      { href: "/value-analysis", label: "Over/Under" },
      { href: "/fee-vs-value", label: "Fee vs Value" },
    ],
  },
  { href: "/injured", label: "Injury Impact" },
  { href: "/biggest-movers", label: "Biggest Movers" },
  {
    href: "/wc-live",
    label: "World Cup",
    children: [
      { href: "/wc-live", label: "Final Results" },
      { href: "/wc-schedule", label: "Full Schedule" },
    ],
  },
] as const;

type NavLink = { href: string; label: string };

// Mobile sheet is a flat list — surface dropdown children as their own rows.
const mobileNavItems = navItems.flatMap((i): NavLink[] =>
  "children" in i
    ? [{ href: i.href, label: i.label }, ...i.children.filter((c) => c.href !== i.href)]
    : [{ href: i.href, label: i.label }],
);

const LEAGUE_NAV = LEAGUES.map((l) => ({
  slug: l.slug,
  name: l.name,
  href: `/leagues/${l.slug}`,
  logoUrl: getLeagueLogoUrl(l.name),
}));

type LeagueNavItem = (typeof LEAGUE_NAV)[number];

function MainNavLink({
  href,
  label,
  variant,
  isActive,
  className,
  ...rest
}: {
  href: string;
  label: string;
  variant: "desktop" | "mobile";
  isActive: boolean;
} & Omit<ComponentProps<typeof Link>, "href">) {
  if (variant === "desktop") {
    return (
      <Button
        variant="ghost"
        size="sm"
        asChild
        className={cn(
          "h-auto px-2 py-1.5 text-sm",
          isActive && "bg-elevated text-text-primary",
          className,
        )}
      >
        <Link {...rest} href={href} aria-current={isActive ? "page" : undefined}>
          {label}
        </Link>
      </Button>
    );
  }
  return (
    <Link
      {...rest}
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "rounded-md px-3 py-2.5 text-base font-medium transition-colors",
        isActive
          ? "bg-elevated text-accent-hot"
          : "text-text-secondary hover:bg-elevated hover:text-text-primary",
        className,
      )}
    >
      {label}
    </Link>
  );
}

// Desktop-only: a nav item whose children open in a dropdown (e.g. World Cup → Live / Schedule).
function NavDropdown({
  item,
  pathname,
}: {
  item: { label: string; children: readonly { href: string; label: string }[] };
  pathname: string;
}) {
  const isActive = item.children.some((c) => c.href === pathname);
  return (
    // Non-modal: don't lock body scroll / strip the scrollbar (that's what shifts the page).
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-auto gap-1 px-2 py-1.5 text-sm",
            isActive && "bg-elevated text-text-primary",
          )}
        >
          {item.label}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {item.children.map((c) => (
          <DropdownMenuItem key={c.href} asChild>
            <Link href={c.href} aria-current={pathname === c.href ? "page" : undefined}>
              {c.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LeagueNavLink({
  league,
  variant,
  isActive,
  className,
  ...rest
}: {
  league: LeagueNavItem;
  variant: "sheet" | "strip";
  isActive: boolean;
} & Omit<ComponentProps<typeof Link>, "href">) {
  const isSheet = variant === "sheet";
  return (
    <Link
      {...rest}
      href={league.href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "items-center rounded-md font-medium transition-colors",
        isSheet ? "flex gap-2 px-3 py-2 text-sm" : "inline-flex shrink-0 gap-1.5 px-2 py-1 text-xs",
        isActive
          ? "bg-elevated text-text-primary"
          : "text-text-secondary hover:bg-elevated hover:text-text-primary",
        className,
      )}
    >
      {league.logoUrl && (
        <img
          src={league.logoUrl}
          alt=""
          className={cn(
            "rounded-sm bg-white/90 object-contain p-px",
            isSheet ? "h-5 w-5" : "h-4 w-4",
          )}
        />
      )}
      <span>{league.name}</span>
    </Link>
  );
}

export function Header() {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const router = useRouter();
  const [isRevalidating, setIsRevalidating] = useState(false);

  const handleBustCache = async () => {
    setIsRevalidating(true);
    try {
      await refreshPage(pathname);
      toast.success("Cache cleared — refreshing page");
      queryClient.clear();
      router.refresh();
    } catch (error) {
      console.error("[refresh] Cache bust failed:", error);
      toast.error("Failed to refresh data");
    } finally {
      setIsRevalidating(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-black/90 backdrop-blur-xl">
      <div className="page-container flex items-center justify-between py-3 sm:py-4">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-2">
          <Image
            src="/icon.png"
            alt="SquadStat"
            width={28}
            height={28}
            className="transition-opacity group-hover:opacity-80"
          />
          <h1 className="text-lg font-pixel tracking-tight text-text-primary transition-opacity group-hover:opacity-80 sm:text-xl">
            Squad<span className="text-accent-hot">Stat</span>
          </h1>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0.5 xl:flex">
          {navItems
            .filter((i) => !("desktopHidden" in i && i.desktopHidden))
            .map((item) =>
              "children" in item ? (
                <NavDropdown key={item.href} item={item} pathname={pathname} />
              ) : (
                <MainNavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  variant="desktop"
                  isActive={pathname === item.href}
                />
              ),
            )}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2 sm:gap-3">
          <PlayerSearch />
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden h-auto p-2 text-text-muted hover:text-text-primary xl:inline-flex"
          >
            <Link href="/how-it-works" aria-label="How it works">
              <HelpCircle className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            onClick={handleBustCache}
            disabled={isRevalidating}
            aria-label={isRevalidating ? "Refreshing data" : "Refresh data"}
            variant={isRevalidating ? "secondary" : "default"}
            size="sm"
            className="h-auto p-2 xl:px-4 xl:py-2"
          >
            {isRevalidating ? (
              <>
                <SpinnerIcon className="h-4 w-4" />
                <span className="hidden xl:inline">Refreshing Data…</span>
              </>
            ) : (
              <>
                <RefreshIcon className="h-4 w-4" />
                <span className="hidden xl:inline">Refresh Data</span>
              </>
            )}
          </Button>

          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 text-text-primary xl:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 border-border-subtle bg-background">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <nav className="mt-8 flex flex-col gap-1">
                {[...mobileNavItems, { href: "/how-it-works", label: "How It Works" }].map(
                  ({ href, label }) => (
                    <SheetClose key={href} asChild>
                      <MainNavLink
                        href={href}
                        label={label}
                        variant="mobile"
                        isActive={pathname === href}
                      />
                    </SheetClose>
                  ),
                )}
              </nav>
              <div className="mt-6 border-t border-border-subtle pt-5">
                <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                  Leagues
                </p>
                <div className="mt-2 flex flex-col gap-1">
                  {LEAGUE_NAV.map((l) => (
                    <SheetClose key={l.slug} asChild>
                      <LeagueNavLink league={l} variant="sheet" isActive={pathname === l.href} />
                    </SheetClose>
                  ))}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="hidden border-t border-border-subtle xl:block">
        <div className="page-container flex items-center gap-1 overflow-x-auto py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {LEAGUE_NAV.map((l) => (
            <LeagueNavLink key={l.slug} league={l} variant="strip" isActive={pathname === l.href} />
          ))}
        </div>
      </div>
    </header>
  );
}
