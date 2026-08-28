"use client";

// PROTOTYPE — throwaway. Delete along with app/transfer-balance-prototype.
import { useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

export function PrototypeSwitcher({
  variants,
  names,
}: {
  variants: string[];
  names: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("variant") ?? variants[0];
  const index = Math.max(0, variants.indexOf(current));

  const go = (delta: number) => {
    const next = variants[(index + delta + variants.length) % variants.length];
    const q = new URLSearchParams(params.toString());
    q.set("variant", next);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border-2 border-black bg-black px-1 py-1 text-white shadow-lg">
      <Button variant="ghost" size="sm" onClick={() => go(-1)} className="rounded-full text-white hover:bg-white/20 hover:text-white">
        ←
      </Button>
      <span className="px-2 text-xs whitespace-nowrap sm:text-sm">
        <span className="font-value font-bold">{current}</span>
        <span className="hidden sm:inline"> — {names[current]}</span>
      </span>
      <Button variant="ghost" size="sm" onClick={() => go(1)} className="rounded-full text-white hover:bg-white/20 hover:text-white">
        →
      </Button>
    </div>
  );
}
