# Finance Manager Deal Workflow

A working tool for a single dealership finance manager. Buys under 10 units a month,
in the lane at Manheim, America's Auto Auction, and IAA. Works on a laptop. Auction
wifi is unreliable — offline is a requirement, not a nice-to-have.

The HTML prototype is `Deal Desk v2.dc.html`. It is the spec for behavior and layout.
Read it before changing the app.

## Stack

- **Next.js (App Router) + TypeScript** — one repo, API routes, no separate backend.
- **Postgres on Supabase** — database, auth, and file storage (title scans, condition
  reports, buyer's orders) in one place.
- **Drizzle ORM + drizzle-kit** for schema and migrations. Migrations are checked in.
- **Tailwind + shadcn/ui** for chrome. The Organic design system tokens drive all
  color, type, radius, and spacing — see `_ds/organic-*/styles.css`. Do not introduce
  hex values or font names the tokens already carry.
- **TanStack Query** for server state. **Zod** on every form and every pasted run list.
- **Vercel** to deploy.

## Offline is a hard requirement

Ship as a PWA. **Dexie (IndexedDB)** is the local write buffer: auction day, bid
logging, and the sale ledger read and write locally and sync to Postgres when the
connection returns. Queue writes with a monotonic local id and reconcile on
reconnect — last-write-wins is acceptable for a single operator.

If hand-rolled sync becomes a maintenance problem, move to **PowerSync** on top of the
same Postgres rather than rewriting the data layer.

## Money

All money is stored as **integer cents**. Never floats, never `numeric` with rounding
left to the client. Format at the edge only.

## Data model

Core tables, in dependency order:

| Table | Holds |
| --- | --- |
| `settings` | Target gross, assumed down, holding cost per day, lane budget. One row. |
| `lenders` | Funding sources. |
| `lender_programs` | Advance %, max term, max LTV, tier rules, fees. Belongs to a lender. |
| `vehicles` | Owned units. Hammer price, buy fee, tow, recon, acquired date, title status. |
| `deals` | A sale against a vehicle. Deal date, lender, stips, funded flag. |
| `leads` | Who wants what. Drives the run-list want-flags. |
| `watch_items` | Units priced for an upcoming sale. Run number, sale date, retail, wholesale, recon estimate, auction house. |
| `sale_comps` | **Append-only.** Every unit watched through a lane: what it brought, your max bid at the time, won/lost, house, date. |

### sale_comps is the asset

`sale_comps` records what a lane did, **including cars you lost**. It is never joined
to a vehicle you bought and rows are never edited or deleted by normal flows. This is
the only market data the operator owns and it is what makes the max-bid math better
than a book value. Protect it: no cascading deletes, no cleanup jobs.

### Max bid

Derived, never stored:

```
room  = retail − target_gross − recon − tow − house_flat_fee − holding_cost
bid   = floor(room / (1 + house_pct_fee / 100))
```

`holding_cost` = the operator's actual average days from acquired to funded, times
holding cost per day. Falls back to 45 days until there is history. Where lender
advance caps the realistic retail, use the capped figure instead.

Keep this in one shared module. Do not reimplement it per screen.

## Conventions

- Server components by default; client components only where there is real interaction.
- One module for money math, one for the bid math, one for run-list parsing. No
  duplicated formulas.
- Run-list paste input is hostile. Parse defensively, show what failed, never drop rows
  silently.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
