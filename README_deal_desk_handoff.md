# Handoff: Finance Manager Deal Workflow (Deal Desk v2)

## Overview

A single-operator desk tool for a dealership finance manager who buys under 10 units a
month in the lane at Manheim, America's Auto Auction, and IAA, and then desks, funds,
and sells those units. It covers the whole loop: price a run list before the sale, set
a max bid, log what every unit brought (won or lost), buy it into inventory, desk the
deal, submit to lenders, collect stips, fund, and read the results back.

The operator works on a laptop, physically at the auction. Auction wifi is unreliable,
so **offline capability is a requirement, not an enhancement**.

## About the design files

The files in this bundle are **design references created in HTML**. They are working
prototypes that show intended look, layout, copy, and behavior. They are **not
production code to copy directly**.

The task is to **recreate these designs in the target codebase's environment**, using
its established patterns, component library, and data layer. The prototype is a single
self-contained HTML file using a small custom template runtime; do not port that runtime.
Port the screens, the math, and the interaction model.

The intended production stack is documented in `CLAUDE.md` (included): Next.js App
Router + TypeScript, Postgres on Supabase, Drizzle ORM, Tailwind + shadcn/ui, TanStack
Query, Zod, Vercel, shipped as a PWA with Dexie as the offline write buffer.

`schema-sketch/schema.ts` and `schema-sketch/bid-math.ts` are already production-shaped
TypeScript. Use them as the starting point rather than re-deriving the model.

## Fidelity

**High fidelity.** Colors, type, spacing, copy, and interactions in the prototype are
final intent. Recreate the UI faithfully using the codebase's existing primitives.
Where a shadcn/ui component covers a pattern in the prototype (dialog, select, table,
tabs), use it and match the visual tokens below rather than hand-rolling markup.

Note on styling: the prototype uses its own neutral system-grey palette (listed under
Design Tokens). The project also has the **Organic** design system available at
`_ds/organic-*/styles.css`. Confirm with the operator which palette ships. If Organic
ships, map the prototype's greys onto Organic's cream/sand ground and its terracotta
accent, keep the semantic colors (green/red/amber) as-is, and take every radius and
spacing value from Organic's `--radius-*` / `--space-*` tokens.

## Information architecture

The app is one page with a left drawer menu (hamburger, top left). Sections are grouped:

**Inventory** — one item per body style (the drawer lists them with live counts);
tabs filter the vehicle list.

**Sourcing**
- Auction watch-list
- Run list
- What to buy
- Buy scorecard
- Auction day
- Sale ledger

**Desk**
- Priority queue
- Analytics

**Marketing & leads**
- Marketing
- Leads

**Lenders** — lender list and programs.

Plus a settings strip (target gross, assumed down, holding cost per day) and a deal
detail view reached by selecting a deal from the queue or inventory.

## Screens

### Run list

**Purpose.** Paste a raw auction run list, get every unit priced against your numbers
before you walk in.

**Layout.** A paste textarea and a house selector at top; below, a table of scored rows.
Summary line above the table reads: `N units read · $X target gross · $Y holding · <house fee label>`.

**Behavior.**
- Paste input is hostile and must be parsed defensively. Show what failed to parse.
  **Never drop rows silently.**
- Each row derives a max bid from the bid math (below) and a headroom figure
  (max bid − auction wholesale). Rows sort by lead demand first, then headroom descending.
- Each row carries up to three badges:
  - **"N leads want this"** — green pill (`#e4f4ea` bg, `#12704a` text). Matched when a
    lead's want text contains both the make and the model.
  - **"N already on the lot"** — amber pill (`#fff3dc` bg, `#8a5100` text). Counts unsold
    vehicles of the same make+model. This is the overstock guard.
  - **Lane history** — `N seen · avg $X`, rendered green when the lane average is at or
    below your max bid, red when above it.
- Each row has a "Watch" action that moves it to the watch-list, carrying year, make,
  model, trim, miles, title, retail, wholesale, note, **run number**, and auction house.

### Auction watch-list

**Purpose.** The units you priced, with the full math open for each one.

**Layout.** A card per unit. Header row: year/make/model, trim and mileage, title badge.
Below the header, two pill-shaped inline inputs: **Run** (number) and **Sale** (date input).
Then a tabbed detail area (banks / math / history).

**The math breakdown** is a stacked list of labelled rows, each with the value
right-aligned and tabular-nums:
- Retail
- Recon
- Tow (fixed $100)
- `Holding · {N}d × ${perDay}` — the derived holding cost
- Target gross
- Buy fee
- **Max bid** (large, 22px, green when positive, red when ≤ 0)

**Lane history block** (only when comps exist for that make+model): a tinted panel,
green (`#e4f4ea` / `#12704a`) when your max bid sits above the lane average, red
(`#fdeceb` / `#a8302a`) when below. Content: `Your lane history · N seen` with the
average, then a sentence — ranged $lo to $hi, you won N — plus one of:
- *"The lane has been going $X past your max — either the retail is light or this one is not yours."*
- *"Your max sits $X above the average — room to win it."*

**Lender tab.** Shows which lender programs will advance enough to support the retail
used in the math, and flags when the lender advance caps realistic retail below the
retail you entered (the math then uses the capped figure).

### Auction day

**Purpose.** The screen that is open during the sale. Everything is glanceable.

**Layout.** A budget strip across the top, then a wide table.

Budget strip: `Budget for the sale` (editable, pill input), `Committed today` (26px),
`Left to spend` (26px, red when over budget), and right-aligned `N units priced` /
`N units bought today`.

Table columns, min-width 1010px, horizontally scrollable:
| Run (64px) | Unit (flex) | Title (112px) | Max bid (132px) | Your lane history (flex) | Actions (210px) |

- **Run** is 19px, semibold, tabular-nums. Rows sort by run number ascending; units
  without a run number sort last.
- **Max bid** is 22px, semibold, green/red. This is the number the operator reads while
  bidding.
- **Lane history** shows `N seen · avg $X` or "no lane history", colored against the max bid.
- **Actions** is a single "Log what it brought" button (`#e7f1ff` bg, `#0058b0` text).
  Clicking swaps the cell to an inline row: a `$` price input prefilled with the max bid,
  then **Bought it** (primary, `#0071e3`), **Lost it** (`#ececed`), **Cancel** (ghost).
  - *Bought it* opens the existing buy flow (hammer price prefilled), which creates the
    vehicle, records buy fee/tow/recon, writes a **won** comp, and removes the watch item.
  - *Lost it* writes a **lost** comp with the price and your max bid, then removes the
    watch item.
- Unit cell is clickable and opens that unit's watch-list detail.

Footer note: *"Log the price even on the ones you lose. Those are the numbers nobody
else at the sale is writing down."*

**Empty state.** Headline "Nothing priced for a sale yet" with a paragraph explaining
the run list → watch-list → auction day path.

### Sale ledger

**Purpose.** The operator's own market data. This is the app's most valuable table.

**Layout.** Two stat cards, then a per-model summary table, then the full append-only log.

**Stat card 1 — "Outbid by, on average."** 32px figure, rendered as `− $X`, red when
positive. Below it, one of three sentences:
- No data: *"Log what a unit brought when you lose it and this tells you how far off your max bid really is."*
- Positive: *"On the N you lost, the lane went $X past your max bid on average. If you want those cars you need cheaper retail, less recon, or a smaller target gross."*
- Negative: *"The ones you lost went for less than your max bid. You were in the money and stopped bidding."*

**Stat card 2.** `N units watched through a lane` and `N won · N lost`.

**Per-model table** ("What each model brings in your lane" / "Your own numbers, not a
book."). Columns: Model | Seen | Avg | Range | Won | Last seen. Grouped by normalized
make+model; **year and trim are deliberately ignored** so three Equinoxes at different
trims still tell you what Equinoxes bring. Sorted by observation count descending.

**Full log.** Columns: Date | Unit | Title | House | Brought | Your max | vs. max | status.
`vs. max` is `+$X` red when the lane beat your max, `−$X` green when it didn't.
Status is a "Bought" (green) or "Lost" (grey) pill. A subtle `×` removes a row — this is
the only delete path and should be treated as a correction tool, not a normal flow.

### What to buy

Demand-side view: which makes/models your open leads are asking for that you do not have
in stock, and which segments turn fastest. Drives what you should be hunting.

### Buy scorecard

Post-mortem on purchases: the retail you bought on versus what the unit actually brought
when it sold, per unit and in aggregate. Shows whether the operator's appraisals run
optimistic and by how much.

### Priority queue

Open deals sorted by a selectable key: Newest / Oldest first / Most urgent / Most stips
out / Least progress / Biggest commission. Each row shows the deal, its stage progress
percentage, open stip count, and projected commission.

### Deal detail

Three-stage checklist model (the prototype defines the stages and steps explicitly — see
the `STAGES` constant in the HTML). Stage 3 is Funding, with steps: collect stips &
insurance, assign plates, contract with the bank. Includes a lender submission list where
each submission carries its own lender, status (approved / counter / declined), and APR —
so one deal submitted to four banks counts on all four in lender analytics.

### Analytics

Deal volume and gross over a selectable range, average hours on the desk, lead
performance by source (leads → applications → deals → sold), and lender performance
(submitted, approvals, funded, declines, look-to-book, close rate, average APR).

### Lenders

Lender records and their programs: advance percentage, max term, max LTV, mileage and
age caps, acquisition fee, allowed title statuses.

### Leads / Marketing

Lead capture with wants, budget, and down payment available; status pipeline. Marketing
shows channel performance feeding the lead sources used in analytics.

## The bid math

**This is the core of the product.** It lives in exactly one module —
`schema-sketch/bid-math.ts` — and must not be reimplemented per screen.

```
room   = retail − target_gross − recon − tow − house_flat_fee − holding_cost
max_bid = floor(room / (1 + house_pct_fee / 100))
```

The bid is **solved for**, not arrived at by subtracting a fee, because the percentage
component of the buy fee scales with the bid itself.

- `tow` is a flat $100 on every unit.
- `holding_cost` = the operator's **actual** average days from acquisition to funding,
  times their holding cost per day (they set $12/day). Falls back to 45 days until there
  is real funding history. Derive the average from funded deals joined to their vehicle's
  acquired date; discard negative spans and anything over 400 days.
- `retail` is the realistic retail, **or the lender-capped retail if that is lower**:
  `book_value × advance_pct + assumed_down`. When the cap binds, the UI must say so.
- House fee tiers in the prototype are plausible placeholders. **Confirm the real
  Manheim / America's / IAA fee schedules before shipping.**

## Money

All money is stored as **integer cents**. Never floats. Never `numeric` with rounding
left to the client. Format only at the render edge.

## Data model

Eight tables. Full Drizzle definitions in `schema-sketch/schema.ts`.

`settings` · `lenders` · `lender_programs` · `vehicles` · `deals` · `leads` ·
`watch_items` · `sale_comps`

### sale_comps is append-only and protected

`sale_comps` records what a lane did, **including cars the operator lost**. It is never
joined to a purchased vehicle, never edited or deleted by normal flows, and never
cascade-deleted. It is the only market data the operator owns, and it is what makes the
max-bid math better than a book value.

Hard rules:
- No `onDelete: cascade` pointing at it.
- No cleanup or dedupe jobs.
- Deleting a vehicle or a watch item must not touch its comp rows.

## Offline behavior

Ship as a PWA. **Dexie (IndexedDB)** is the local write buffer. Auction day, bid logging,
and the sale ledger read and write locally first and sync to Postgres when the connection
returns. Queue writes with a monotonic local id and reconcile on reconnect;
last-write-wins is acceptable for a single operator.

Auction day and the sale ledger are the screens that **must** work with no connection.
Everything else can degrade.

If hand-rolled sync becomes a maintenance burden, move to **PowerSync** over the same
Postgres rather than rewriting the data layer.

## State

Persisted locally in the prototype (localStorage keys, for reference when migrating a
user's existing data):
- `fmdesk.comps.v1` — sale comps
- `fmdesk.holdday.v1` — holding cost per day
- `fmdesk.laneday.v1` — lane budget
- plus deals, vehicles, watch-list, leads, lenders, target gross, assumed down, and
  drawer open/closed state

Transient UI state: active section, inventory tab, selected deal/vehicle/watch id,
watch detail tab, buy dialog id and hammer input, auction-day logging row id and price
input, run-list paste text and parsed rows, sort keys, analytics range.

## Design tokens (as built in the prototype)

**Type.** Inter Tight throughout (Google Fonts). Sizes in use: 10.5px uppercase
labels (600 weight, .05em tracking), 11–12.5px meta and body, 13.5–15px row titles
(600), 19px run numbers, 22px max bid, 26px budget figures, 32px headline stats.
Negative letter-spacing on large figures: −.01em to −.03em. Money and counts always
`font-variant-numeric: tabular-nums`.

**Color.**
| Role | Value |
| --- | --- |
| Page text | `#1d1d1f` |
| Muted text | `#6e6e73` |
| Placeholder / tertiary | `#8e8e93` |
| Surface | `#ffffff` |
| Subtle fill / chips | `#f5f5f7` |
| Row hover | `#fafafc` |
| Hairline | `#f2f2f5` |
| Header rule | `#ececef` |
| Primary action | `#0071e3`, hover `#0058b0` |
| Secondary action | `#ececed`, hover `#e2e2e4` |
| Info action | `#e7f1ff` bg / `#0058b0` text, hover `#d8e8fc` |
| Positive | `#1a8a52` / `#12704a` on `#e4f4ea` |
| Negative | `#a8302a` / `#c7362f` on `#fdeceb` |
| Caution | `#8a5100` on `#fff3dc` |
| Delete affordance | `#c7c7cc`, hover `#c7362f` |

**Radius.** 18px cards, 11px inset panels, 999px pills, buttons, and inputs.

**Shadow.** Cards: `0 1px 2px rgba(0,0,0,.05), 0 6px 20px rgba(0,0,0,.04)`.

**Spacing.** Card padding 20px; table cell padding 13–15px vertical / 18px horizontal;
grid gaps 10–12px; section gaps 14–16px.

**Tables.** CSS grid with explicit `grid-template-columns`, a `min-width` on both header
and rows, and `overflow-x: auto` on the wrapper so wide tables scroll instead of
compressing. Header row is 10.5px uppercase on `#8e8e93` with a `#ececef` bottom rule.

## Assets

No images or icon fonts. All iconography is text glyphs or CSS shapes. Inter Tight is
loaded from Google Fonts. If Organic ships as the visual system, use Lucide icons at
stroke-width 2.75 per its guide.

## Files in this bundle

| File | What it is |
| --- | --- |
| `Deal Desk v2.dc.html` | The full prototype. The spec for layout and behavior. |
| `support.js` | The prototype's template runtime. **Reference only — do not port.** |
| `CLAUDE.md` | Project instructions: stack, offline requirement, money rule, model. |
| `schema-sketch/schema.ts` | Drizzle schema for all eight tables. Production-shaped. |
| `schema-sketch/bid-math.ts` | Fees, landed cost, turn days, max bid, lender cap, comp reads. |

Open `Deal Desk v2.dc.html` in a browser to use the prototype directly. It is fully
interactive and persists to localStorage.

## Open questions for the operator

1. Real buy-fee schedules for Manheim, America's Auto Auction, and IAA — the prototype's
   are placeholders.
2. Does the sale ledger sync from day one, or stay laptop-local? Retrofitting sync onto a
   local-only table later is the painful version.
3. Organic palette or the prototype's neutral greys?
4. Is target gross one flat number, or per segment? The prototype uses one flat number
   and that is a known limitation for a $9k car versus a $38k truck.
