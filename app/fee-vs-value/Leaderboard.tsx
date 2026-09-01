"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VirtualList } from "@/components/VirtualList";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useQueryParams } from "@/lib/hooks/use-query-params";
import {
  gapScale,
  rank,
  summarize,
  transferKey,
  withRanks,
  type PricedTransfer,
} from "@/lib/fee-vs-value";
import {
  PATH,
  VIEWS,
  VIEW_KEYS,
  resolve,
  type ListOption,
  type Ranked,
  type View,
  type ViewSpec,
} from "@/lib/fee-vs-value-rankings";
import { ClubTables } from "./ClubTables";
import { TransferRow } from "./TransferRow";
import { WindowSummary } from "./WindowSummary";

/** Roughly a row at desktop width; the virtualizer measures each one for real
 *  once mounted, so a wrapped row on mobile corrects itself. */
const ROW_ESTIMATE = 116;
const ROW_GAP = 8;

/** Every row, not a top-N: the interesting deals are as often 40th as 4th.
 *  Window-virtualized so 200 rows cost what a screenful costs. */
function TransferList({
  spec,
  option,
  ranked,
  axisMax,
}: {
  spec: Extract<ViewSpec, { kind: "list" }>;
  option: ListOption;
  ranked: Ranked;
  axisMax: number;
}) {
  const other = spec.options.find((o) => o.slug !== option.slug);
  // Competition ranking, so tied deals share a number rather than one of them
  // arbitrarily sitting above the other.
  const list = useMemo(() => withRanks(option.list(ranked), option.format), [option, ranked]);

  return (
    <div className="mt-3">
      <VirtualList
        items={list}
        estimateSize={ROW_ESTIMATE}
        gap={ROW_GAP}
        // Not the player id: eight of this window's players moved twice, and a
        // repeated key lets the virtualiser reuse the wrong row on a re-sort.
        keyExtractor={({ transfer: t }) => transferKey(t)}
        renderItem={({ transfer: t, rank: r }) => (
          <TransferRow
            transfer={t}
            rank={r}
            tone={spec.tone}
            metric={option.format(t)}
            secondary={other?.format(t)}
            axisMax={axisMax}
          />
        )}
      />
    </div>
  );
}

export function Leaderboard({
  transfers,
  season,
}: {
  transfers: PricedTransfer[];
  season: number;
}) {
  const { params, update, replace } = useQueryParams(PATH);
  const resolved = resolve(params.get("view"), params.get("by"));
  const { key: view, spec, option } = resolved;

  // Sorted here rather than on the server: the six orderings are six views of
  // the same objects, and shipping them pre-sorted put every transfer on the
  // wire once per list that mentioned it. Sorting ~200 rows costs nothing.
  const ranked = useMemo(() => rank(transfers), [transfers]);
  const summary = useMemo(() => summarize(transfers), [transfers]);
  // One ruler for every bar on the page, so switching tabs reorders the rows
  // without redrawing the scale underneath them.
  const axisMax = useMemo(() => gapScale(transfers), [transfers]);

  // Switching view is a real navigation — the tabs are links, so they can be
  // opened in a tab, copied, or walked with the back button. The plain click is
  // handled here instead so it costs a re-render rather than a round trip for
  // the whole transfer list.
  const goToView = (v: View) => update({ view: v, by: null });
  const onTabClick = (e: React.MouseEvent, v: View) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    goToView(v);
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <WindowSummary season={season} summary={summary} />

      <section>
        <Tabs value={view} onValueChange={(v) => goToView(v as View)}>
          <TabsList>
            {VIEW_KEYS.map((v) => (
              <TabsTrigger key={v} value={v} asChild>
                <Link href={`${PATH}?view=${v}`} prefetch={false} onClick={(e) => onTabClick(e, v)}>
                  {VIEWS[v].tab}
                </Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* The measure sits with the heading it rewrites. It meant something
            different in every tab while floating at the far end of the tab row,
            so the reader had to guess which pair of words applied. */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <h2 className="text-base font-pixel font-bold text-text-primary sm:text-lg">
              {option.title}
            </h2>
            <p className="mt-1 text-sm text-text-muted">{option.blurb}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
              {spec.control}
            </span>
            <ToggleGroup
              type="single"
              value={option.slug}
              onValueChange={(v) => v && replace({ by: v })}
              variant="outline"
              size="sm"
              className="rounded-lg"
              aria-label={spec.control}
            >
              {spec.options.map((o, i) => (
                <ToggleGroupItem
                  key={o.slug}
                  value={o.slug}
                  className={edgeRounding(i, spec.options.length)}
                >
                  {o.toggle}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>

        {resolved.kind === "clubs" ? (
          <div className="mt-4">
            <ClubTables transfers={transfers} spec={resolved.option} />
          </div>
        ) : (
          <TransferList
            spec={resolved.spec}
            option={resolved.option}
            ranked={ranked}
            axisMax={axisMax}
          />
        )}
      </section>
    </div>
  );
}

/** Round only the outer edges of a segmented control, whatever its length. */
function edgeRounding(i: number, total: number) {
  if (i === 0) return "rounded-l-lg";
  if (i === total - 1) return "rounded-r-lg";
  return "";
}
