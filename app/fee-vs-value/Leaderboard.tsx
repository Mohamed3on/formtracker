"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VirtualList } from "@/components/VirtualList";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useQueryParams } from "@/lib/hooks/use-query-params";
import { formatMarketValue, formatPremium, formatRatio } from "@/lib/format";
import {
  gapScale,
  rank,
  summarize,
  transferKey,
  withRanks,
  type PricedTransfer,
} from "@/lib/fee-vs-value";
import { CLUB_MODES, ClubTables, type ModeSpec } from "./ClubTables";
import { TransferRow, type Tone } from "./TransferRow";
import { WindowSummary } from "./WindowSummary";

const PATH = "/fee-vs-value";

type Ranked = ReturnType<typeof rank>;
type View = "biggest" | "overpaid" | "bargains" | "clubs";

interface Option {
  /** What this measure is called in the URL. Short and guessable, so a shared
   *  link says what it opens rather than carrying an array index. */
  slug: string;
  toggle: string;
  title: string;
  blurb: string;
}

/** A leaderboard of transfers: which ranked slice to show, and how each row's
 *  headline figure reads. The formatter doubles as the tie test — two rows
 *  showing the same figure share a rank. */
interface ListOption extends Option {
  list: (r: Ranked) => PricedTransfer[];
  format: (t: PricedTransfer) => string;
}

/** Each view keeps its own pair of measures, so the control beside the heading
 *  always offers the two that make sense for what's on screen. Clubs renders
 *  tables rather than a row list, which is why it's a separate kind rather than
 *  a list view with holes in it. */
type ViewSpec = {
  tab: string;
  /** Caption on the measure control. The control means something different in
   *  every view, so it says which question it is answering rather than leaving
   *  the reader to infer it from two bare words. */
  control: string;
  defaultBy: string;
} & (
  | { kind: "list"; tone: Tone; options: [ListOption, ListOption] }
  // A ModeSpec already carries everything an Option does, so the club views
  // list the specs themselves rather than a copy of four of their fields.
  | { kind: "clubs"; options: ModeSpec[] }
);

const VIEWS: Record<View, ViewSpec> = {
  biggest: {
    tab: "Biggest",
    kind: "list",
    tone: "neutral",
    control: "Rank by",
    defaultBy: "value",
    options: [
      {
        slug: "fee",
        toggle: "Fee",
        title: "Most expensive signings",
        blurb: "The biggest fees of the season, whatever the player was worth.",
        list: (r) => r.byFee,
        format: (t) => formatMarketValue(t.fee),
      },
      {
        slug: "value",
        toggle: "Value",
        title: "Most valuable signings",
        blurb: "The best players to move, by what they are worth, whatever their club paid.",
        list: (r) => r.byValue,
        format: (t) => formatMarketValue(t.worth),
      },
    ],
  },
  overpaid: {
    tab: "Overpaid",
    kind: "list",
    tone: "over",
    control: "Rank by",
    defaultBy: "cash",
    options: [
      {
        slug: "cash",
        toggle: "Cash",
        title: "Paid the most over the odds",
        blurb:
          "How much more than the player is worth the club paid. Big transfers lead this list.",
        list: (r) => r.overpaidAbsolute,
        format: (t) => formatPremium(t.premium),
      },
      {
        slug: "ratio",
        toggle: "Times value",
        title: "Paid the most times his value",
        blurb:
          "The same gap as a multiple. Small transfers lead this list — a €5M player at €15M is 3.00×, where a €100M signing rarely clears 1.50×.",
        list: (r) => r.overpaidRatio,
        format: (t) => formatRatio(t.ratio),
      },
    ],
  },
  bargains: {
    tab: "Bargains",
    kind: "list",
    tone: "under",
    control: "Rank by",
    defaultBy: "cash",
    options: [
      {
        slug: "cash",
        toggle: "Cash",
        title: "Biggest bargains in cash",
        blurb: "How much less than the player is worth the club paid.",
        list: (r) => r.underpaidAbsolute,
        format: (t) => formatPremium(t.premium),
      },
      {
        slug: "ratio",
        toggle: "Times value",
        title: "Biggest bargains, times value",
        blurb: "The fee as a share of what the player is worth. 0.50× means half price.",
        list: (r) => r.underpaidRatio,
        format: (t) => formatRatio(t.ratio),
      },
    ],
  },
  clubs: {
    tab: "Clubs",
    kind: "clubs",
    control: "Show",
    defaultBy: "buying",
    options: Object.values(CLUB_MODES),
  },
};

const VIEW_KEYS = Object.keys(VIEWS) as View[];

/** The URL is the state. Anything unknown, missing or malformed lands on the
 *  defaults rather than on an empty list, and the pair is resolved the same way
 *  on the server as in the browser, so the first paint already has the right
 *  tab open. */
function resolve(view: string | null, by: string | null) {
  const key = view && view in VIEWS ? (view as View) : "biggest";
  const spec = VIEWS[key];
  const pick = <O extends Option>(options: readonly O[]): O =>
    options.find((o) => o.slug === by) ??
    options.find((o) => o.slug === spec.defaultBy) ??
    options[0];
  // The discriminant is hoisted onto the result. Narrowing on a nested
  // `spec.kind` leaves the sibling `option` un-narrowed, which is what used to
  // force a cast at each render site.
  return spec.kind === "clubs"
    ? ({ kind: spec.kind, key, spec, option: pick(spec.options) } as const)
    : ({ kind: spec.kind, key, spec, option: pick(spec.options) } as const);
}

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
    <div role="list" className="mt-3">
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
