import { buildClubWindows, rank, type ClubWindow, type PricedTransfer } from "@/lib/fee-vs-value";
import { formatMarketValue, formatPremium, formatRatio } from "@/lib/format";

/**
 * Every ranking the fee-vs-value page offers, and what topping one is called
 * elsewhere on the site.
 *
 * The specs used to live inside the two client components that render them,
 * which was fine while the page was their only reader. A player's own page and
 * a club's own page now badge whoever tops a list, and a badge derived from a
 * second, hand-written copy of "who is #1" is a copy that drifts — the same
 * failure `rank` and `summarize` once had, where one learned to exclude
 * unpriced moves and the other went on counting them. One definition, read by
 * the page and by the badges alike, cannot drift.
 *
 * Pure: no filesystem, no cheerio, no React. `Leaderboard` and `ClubTables` are
 * client components and the badges are server components, so this has to be
 * safe in both bundles.
 */

/** Over the odds, under it, or exactly on it. Defined here rather than beside
 *  the row that paints it because the specs below are typed on it. */
export type Tone = "over" | "under" | "neutral";

/** Where every ranking on this page lives. */
export const PATH = "/fee-vs-value";

/** TM keys a season by its starting year. */
export function seasonLabel(season: number): string {
  return `${season}/${String((season + 1) % 100).padStart(2, "0")}`;
}

const money = formatMarketValue;
const signed = formatPremium;

// ---------------------------------------------------------------------------
// Club tables
// ---------------------------------------------------------------------------

/** Which side of a window a club row reads from. */
export type Side = "in" | "out";

/** One end of a mode's single ranking — its top, then its bottom. Only what
 *  actually differs between the two lives here; the measure itself is shared,
 *  which is what makes them genuine opposites rather than two similar tables. */
export type EndSpec = {
  /** Doubles as the badge on the club that tops this end. A verb phrase, so it
   *  stays true when two clubs tie on it — unlike the player accolades below,
   *  it needs no "joint" form. */
  title: string;
  tone: Extract<Tone, "over" | "under">;
  /** Which side of the window a row expands into. */
  side: Side;
  /** Which clubs belong at this end at all. Defaults to "did something on that
   *  side of the window". */
  qualifies?: (c: ClubWindow) => boolean;
};

/** Which question a club table asks, and how it answers it. `sort` is descending;
 *  the second end reads the same order from the other end. */
export type ModeSpec = {
  /** What this mode is called in the URL. */
  slug: string;
  toggle: string;
  title: string;
  blurb: string;
  sort: (c: ClubWindow) => number;
  /** The big figure on each row. */
  figure: (c: ClubWindow) => string;
  caption: (c: ClubWindow) => string;
  /** Small figure under it. Defaults to the fee-to-value ratio of that side. */
  badge?: (c: ClubWindow) => string | null;
  /** Draw the value-against-fees bar under the caption. Off where the mode ranks
   *  on something else — a bar plotting figures the row isn't ranked on reads as
   *  a contradiction, or worse, as a control. */
  bar?: boolean;
  /** Which moves an expanded row lists. Defaults to the end's own `side`, which
   *  is right when the headline only counts one side. Where it nets the two —
   *  squad value — the expansion has to show both, or half the number it is
   *  explaining is missing from the list underneath it. */
  expand?: "in" | "out" | "both";
  ends: [EndSpec, EndSpec];
};

export const CLUB_MODES = {
  buying: {
    slug: "buying",
    bar: true,
    toggle: "Buying",
    title: "Who bought well",
    blurb:
      "Fees paid against what the players were worth. A club that paid under value shopped well.",
    sort: (c) => c.in.premium,
    figure: (c) => signed(c.in.premium),
    caption: (c) => `${money(c.in.marketValue)} of players for ${money(c.in.fees)}`,
    ends: [
      { title: "Paid over the odds", tone: "over", side: "in" },
      { title: "Shopped best", tone: "under", side: "in" },
    ],
  },
  selling: {
    slug: "selling",
    bar: true,
    toggle: "Selling",
    title: "Who sold well",
    blurb:
      "The same sum from the other end: fees banked against what the players leaving were worth.",
    sort: (c) => c.out.premium,
    figure: (c) => signed(c.out.premium),
    caption: (c) => `${money(c.out.marketValue)} of players for ${money(c.out.fees)}`,
    ends: [
      // Banking more than a player was worth is the good outcome here, so the
      // colours run opposite to the buying tables.
      { title: "Sold above value", tone: "under", side: "out" },
      { title: "Sold below value", tone: "over", side: "out" },
    ],
  },
  "squad-value": {
    slug: "squad-value",
    toggle: "Squad value",
    title: "Who gained and who lost",
    blurb:
      "Value in minus value out, whatever it cost. The badge is the money that swing took, in fees paid minus fees banked.",
    // Ranked on net, not on gross: a club that brings in €292m and lets €268m
    // go has not gained €292m of anything. Gross sits in the caption, and the
    // two ends are genuine opposites — no club can top both.
    sort: (c) => c.netValue,
    figure: (c) => signed(c.netValue),
    caption: (c) => `${money(c.in.marketValue)} in · ${money(c.out.marketValue)} out`,
    badge: (c) => `${signed(c.netSpend)} net`,
    // The figure nets both sides, so the expansion has to list both.
    expand: "both",
    ends: [
      {
        title: "Gained the most value",
        tone: "under",
        side: "in",
        qualifies: (c) => c.netValue > 0,
      },
      {
        title: "Lost the most value",
        tone: "over",
        side: "out",
        qualifies: (c) => c.netValue < 0,
      },
    ],
  },
} satisfies Record<string, ModeSpec>;

/** The three cuts, keyed by the slug that names them in the URL. `slug` was
 *  always the public name; keying on it too means there is one vocabulary for a
 *  mode rather than an internal name and a URL name that had to be mapped
 *  between. */
export type ClubMode = keyof typeof CLUB_MODES;

/**
 * One end of a mode's ranking, in display order and unsliced.
 *
 * The top end reads the shared sort from its top and the bottom end from its
 * bottom, which is what makes the two genuine opposites. The table takes the
 * first `TOP` of this; a badge takes the first one. Sharing the function is the
 * point — a club badged "Shopped best" is by construction the club sitting at
 * the head of the table it links to.
 */
export function rankClubs(rows: ClubWindow[], mode: ModeSpec, endIndex: 0 | 1): ClubWindow[] {
  const end = mode.ends[endIndex];
  const ranked = rows
    .filter((c) => c[end.side].players > 0 && (end.qualifies?.(c) ?? true))
    .sort((a, b) => mode.sort(b) - mode.sort(a));
  return endIndex === 1 ? ranked.reverse() : ranked;
}

// ---------------------------------------------------------------------------
// Player lists
// ---------------------------------------------------------------------------

/** The six sorted slices every player list reads off. */
export type Ranked = ReturnType<typeof rank>;

export interface Option {
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
export interface ListOption extends Option {
  list: (r: Ranked) => PricedTransfer[];
  format: (t: PricedTransfer) => string;
  /** What topping this list is called on the player's own page. A noun phrase,
   *  because it has to survive a "Joint " prefix when two deals tie.
   *
   *  Absent on the two times-value lists deliberately: `3.50×` on a hero badge,
   *  away from the page that explains the measure, invites the reading that the
   *  club paid €3.50M over — which is not what it says. */
  accolade?: string;
}

/** Each view keeps its own pair of measures, so the control beside the heading
 *  always offers the two that make sense for what's on screen. Clubs renders
 *  tables rather than a row list, which is why it's a separate kind rather than
 *  a list view with holes in it. */
export type ViewSpec = {
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

export type View = "biggest" | "overpaid" | "bargains" | "clubs";

export const VIEWS: Record<View, ViewSpec> = {
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
        accolade: "Most expensive signing",
      },
      {
        slug: "value",
        toggle: "Value",
        title: "Most valuable signings",
        blurb: "The best players to move, by what they are worth, whatever their club paid.",
        list: (r) => r.byValue,
        format: (t) => formatMarketValue(t.worth),
        accolade: "Most valuable signing",
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
        accolade: "Most overpaid signing",
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
        accolade: "Biggest bargain",
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

export const VIEW_KEYS = Object.keys(VIEWS) as View[];

/** The URL is the state. Anything unknown, missing or malformed lands on the
 *  defaults rather than on an empty list, and the pair is resolved the same way
 *  on the server as in the browser, so the first paint already has the right
 *  tab open. */
export function resolve(view: string | null, by: string | null) {
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

// ---------------------------------------------------------------------------
// Accolades — what topping one of the above is called on a player's or a club's
// own page.
// ---------------------------------------------------------------------------

export interface Accolade {
  /** Reads on its own, away from the page that frames it. */
  title: string;
  /** The figure that won it, already formatted by the list's own formatter. */
  figure: string;
  /** The exact view this row leads, so the badge lands the reader on the table
   *  it is quoting rather than on the default tab. */
  href: string;
  tone: Tone;
}

/**
 * First place, and everyone sharing it.
 *
 * Ties are decided on the figure the badge actually prints, exactly as
 * `withRanks` does for the page's own rankings: two rows reading `€110.0M` are
 * a dead heat to the reader, and ranking one above the other on a difference
 * they cannot see is noise. It is not hypothetical — the current window has a
 * joint most valuable signing.
 */
function leaders<T>(ranked: T[], format: (x: T) => string): { top: T[]; figure: string } | null {
  if (ranked.length === 0) return null;
  const figure = format(ranked[0]);
  let n = 1;
  while (n < ranked.length && format(ranked[n]) === figure) n += 1;
  return { top: ranked.slice(0, n), figure };
}

/** "Most expensive signing" → "Joint most expensive signing". */
function joint(title: string): string {
  return `Joint ${title.charAt(0).toLowerCase()}${title.slice(1)}`;
}

/** Every list this player's moves lead. A player who moved twice in the window
 *  can lead one on either move, which is why this matches on id rather than on
 *  a single transfer. */
export function playerAccolades(transfers: PricedTransfer[], playerId: string): Accolade[] {
  const ranked = rank(transfers);
  const out: Accolade[] = [];
  for (const view of VIEW_KEYS) {
    const spec = VIEWS[view];
    if (spec.kind !== "list") continue;
    for (const option of spec.options) {
      if (!option.accolade) continue;
      const led = leaders(option.list(ranked), option.format);
      if (!led?.top.some((t) => t.playerId === playerId)) continue;
      out.push({
        title: led.top.length > 1 ? joint(option.accolade) : option.accolade,
        figure: led.figure,
        href: `${PATH}?view=${view}&by=${option.slug}`,
        tone: spec.tone,
      });
    }
  }
  return out;
}

/** Every club-table end this club heads. Both ends of all three modes, so a
 *  club that both shopped best and gained the most value says both — they are
 *  different facts, and the badge row wraps. */
export function clubAccolades(
  rows: ClubWindow[],
  clubId: string,
): Array<Accolade & { mode: ClubMode }> {
  const out: Array<Accolade & { mode: ClubMode }> = [];
  for (const mode of Object.keys(CLUB_MODES) as ClubMode[]) {
    const spec: ModeSpec = CLUB_MODES[mode];
    for (const endIndex of [0, 1] as const) {
      const led = leaders(rankClubs(rows, spec, endIndex), spec.figure);
      if (!led?.top.some((c) => c.club.clubId === clubId)) continue;
      out.push({
        // No "joint" form: the end titles are verb phrases, and "Gained the most
        // value" stays true of both clubs when two tie on it.
        title: spec.ends[endIndex].title,
        figure: led.figure,
        href: `${PATH}?view=clubs&by=${spec.slug}`,
        tone: spec.ends[endIndex].tone,
        mode,
      });
    }
  }
  return out;
}

/**
 * A club's window, and every end of it the club leads.
 *
 * Loans counted, which is both the page's own default and the truer answer to
 * "what did the squad gain" — a €50m striker in on loan is in the dressing
 * room. Returns nothing at all for a club with no business among the season's
 * biggest transfers, which is most of them.
 */
export function clubWindowSummary(transfers: PricedTransfer[], clubId: string) {
  const rows = buildClubWindows(transfers);
  const club = rows.find((c) => c.club.clubId === clubId);
  if (!club) return null;
  return { club, accolades: clubAccolades(rows, clubId) };
}
