# Working notes — autonomous session

Started while you were away, per your instruction to keep improving the app,
scaffold WhatsApp + Google Calendar, brainstorm a "one-stop-shop" feature set,
and do a UI polish pass. Nothing here is pushed to GitHub — local commits only,
on `main`, so you can review the diffs before deciding what to push.

**Round 2**, after you came back and picked from the brainstorm list below:
warranty/F&I database, Deal Copilot, WhatsApp sold-automation, and the
referral message — all four built this round, see "Done this session". You
also said no to e-sign and reserve/participation tracking — crossed out
below, not built.

**Round 3**: fixed the modal centering glitch and added AutoCheck upload +
a manual "Add unit" form to the watch-list, then built the four things you
picked next — desk brief, post-sale check-ins, the Facebook/Instagram
webhook, and confirmed the Anthropic key setup (Deal Copilot was already
built, just needed the key documented clearly). Also answered your JD
Power pricing question — see the Inventory/sourcing ideas section.

**If ANTHROPIC_API_KEY (or any env var) ever shows "Not connected" even
though you're sure it's in `.env.local` correctly**: two real bugs bit us
getting this working, worth knowing about:
1. **VS Code's Console Ninja extension breaks env loading inside VS Code's
   own integrated terminal.** It hooks into the Node runtime for its
   console-log-in-editor feature, and something about that hook stops
   `next dev` from picking up `.env.local` changes — even after a full
   restart, even after clearing `.next`. Toggling the extension off in VS
   Code's Extensions panel isn't enough either; it stays attached until a
   full VS Code window reload. **Fix: run `npm run dev` from a plain
   Terminal.app window instead of VS Code's built-in terminal.** If you'd
   rather keep using VS Code's terminal, fully reload the VS Code window
   (not just disable-the-extension) after toggling Console Ninja off.
2. **A stray `package-lock.json` in your home folder confuses Turbopack's
   project-root detection**, which printed a warning
   ("ignored package-lock.json ... outside the current Git repository")
   and, near as we could tell, was also affecting where env files got
   resolved from. Fixed permanently in `next.config.ts` — it now pins
   `turbopack.root` explicitly to this project's own folder, so this can't
   happen again regardless of what else exists elsewhere on your machine.
   Nothing for you to do here, already fixed and committed.

Both had to happen together to fully explain what we saw — the Console
Ninja issue alone would've been enough to break it, but we also found the
key's actual *value* had gotten clobbered with the wrong clipboard content
partway through troubleshooting (an artifact of one specific fix attempt,
not a recurring risk). If you ever add a new env var and it won't take,
try Terminal.app first before anything else.

**Round 4**: built the task/reminder system you picked off the priority
list — see "Done this session" below.

**Round 5**: the redesign pass matching the Claude Design mockup — nav,
board card layout, month filter bug, sort, merged stips into the checklist,
in-context appointment modal, and removed the History tab. See "Done this
session" for the full list, and one honest caveat: I worked from your
description of where things sat in the mockup, not a fresh look at the
image (it wasn't available to me this round) — so spacing/typography match
the existing Organic design tokens throughout, but if anything still looks
off next to the mockup, point me at it and I'll fix that spot directly.

**Round 6**: first live-deploy debugging round, now that the app is
actually on Vercel. Fixed three real bugs that only show up in
production, not local dev — see "Done this session":
1. Every DB-backed page was silently static-prerendered at build time
   (Next.js's default when nothing signals otherwise), so `next build`
   tried to connect to Postgres during the build itself instead of at
   request time — worked locally by coincidence (a real DB was always
   reachable during my builds), broke on Vercel's build machine.
2. The homepage redirected to the watch-list from before the redesign
   made Dashboard the actual entry point — now lands on the deals board.
3. **File uploads were 500ing in production** — `lib/storage.ts` wrote to
   local disk, which Vercel's serverless functions can't do (read-only
   filesystem outside `/tmp`). Swapped to Supabase Storage, see
   "Scaffolded, not wired up" below for the two env vars this needs.

**Round 7**: more live-deploy bug reports plus two feature requests.
The TurboPass extraction now shows a full transaction-level income
breakdown (payroll grouped by holder, Zelle/cash grouped separately,
related-party transfers excluded, split correctly when an account has
more than one person or more than one payroll source) instead of a flat
summary, buttons everywhere got real hover/press feedback, a bank/income
badge now shows on the dashboard cards (it only used to show once you
opened a deal), and clicking that badge — or the credit-grade badge next
to it — no longer misfires into a full page navigation. Biggest one:
**clicking a deal card had a real, fixable lag** — the intercepted modal
route had no loading state at all, so Next.js showed nothing until all
8 of the deal page's queries finished; it now shows an instant skeleton
(confirmed ~30ms vs. ~350ms+ of nothing beforehand) and lets Next.js
prefetch the modal shell as cards scroll into view. Also added a rep
phone field to Lenders and laid that page out as a grid instead of one
stacked column — **needs `catchup-all.sql` run against Supabase** (see
below) before rep phone will actually save in production.

**Round 8**: found and fixed a bug in my own Round 7 performance fix —
I'd shrunk the DB connection pool to 5, but a deal modal fires 8 queries
at once, so 3 of them were queuing behind the other 5 instead of running
in parallel (measured: 253ms vs. 125ms for the same 8 queries at pool
size 5 vs. 15 — fixed by raising it back up). Also made the whole deal
card clickable instead of just the customer-name area, added a Louisiana
out-of-state tax/fee calculator (nav: Tools, above Lenders — formula and
every fee transcribed from two real ATC quotes, not estimated; grows
parish by parish as you send me new quotes), explained the WhatsApp
"ContentSid Required" error instead of showing it raw (it's Meta's own
24-hour-window policy, not a bug — see the WhatsApp section below), and
rebuilt the whole nav as a DealerCenter-style icon rail with flyout
subcategories plus a real Home dashboard (quicklinks + Customers/
Inventory/Appointments summary cards) — Integrations moved to its own
gear-icon Settings tab. Biggest build this round: **AI-generated
marketing listings**, one per vehicle, auto-populated the moment you add
it to inventory — see "Done this session" for the full rundown, and
**this one also needs `catchup-all.sql` run against Supabase** (new
`marketing_posts` table plus three new `vehicles` columns).

**Round 9**: removed the "All this month" tab (redundant with the month
strip above it), added a standalone PTI calculator, redesigned the stage
checklist to match a mockup you sent (numbered badges, circular
checkmarks, per-stage "Check all" pills), and built insurance
verification — see "Done this session" for the full rundown. **Needs the
same Supabase step as the last two rounds**: `catchup-all.sql` now also
adds `lenders.address`, `lenders.max_deductible_cents`, and
`deals.lienholder_name` — insurance verification won't work in
production until that runs.

## How to read this file

- **Needs your call** — genuine business/product decisions I set aside instead
  of guessing. Answer these when you're back and I'll build the rest.
- **Done this session** — what actually shipped, verified (tsc/eslint/build/
  Playwright where applicable), one line each.
- **Scaffolded, not wired up** — structure exists (schema, UI, stub routes)
  but needs a real credential/API key from you before it does anything live.
- **Ideas for later** — brainstormed, not started. No effort spent guessing
  at scope for these.

---

## Needs your call

- **AI auto-reply to general inbound WhatsApp** — this is narrower than it
  was before: the two specific triggers you asked for (deal goes funded →
  first-payment/lienholder text; referral message) are now built and fully
  automatic/on-demand, no AI drafting involved — see "Done this session"
  below. What's still unbuilt is the general case: a customer texts in out
  of nowhere with a question, and an AI drafts or sends the reply. Two real
  reasons I didn't just build something, not me being timid: (1) an LLM
  improvising about pricing, approval odds, or payment numbers to a real
  customer over WhatsApp is a liability problem if it gets something wrong
  — dealership compliance stuff, not a coding question I can answer for
  you; (2) TCPA — texting customers (WhatsApp counts) generally needs
  documented consent, and I don't know what your current consent capture
  looks like. Tell me when you're back: should the agent (a) draft replies
  for a human to approve before sending, (b) only auto-reply to a narrow
  whitelist of questions ("what are your hours," "is the F-150 still
  available"), or (c) something else? I'll build whichever once you pick.
- **Deal Copilot** — built and wired up (chat button on every deal page),
  but it's genuinely idle until you add `ANTHROPIC_API_KEY` — see
  "Scaffolded, not wired up" below for the one-line setup. Nothing else to
  decide; no design question attached to this one.
- **Google Calendar — which calendar, whose account** — the OAuth scaffolding
  (below) assumes one dealership Google account connects once and every
  appointment syncs to its primary calendar. If you actually want per-salesperson
  calendars, or a shared dealership calendar separate from someone's personal
  one, say so and I'll adjust before you connect it for real.

---

## Done this session

- **Three production-only bugs found and fixed post-deploy** — none of
  these showed up locally, only once the app was actually live on Vercel:
  1. Every DB-backed page (`/desk/tasks`, `/inventory`, `/leads`,
     `/lenders`, `/marketing`, `/sourcing/*`, `/warranty`, both deal-detail
     routes, etc.) now explicitly forces per-request rendering
     (`export const dynamic = "force-dynamic"`) instead of letting
     Next.js silently try to statically prerender them at build time,
     which is what caused the `ECONNREFUSED 127.0.0.1:5432` build failure
     you hit. Verified by building with a deliberately unreachable,
     garbage `DATABASE_URL` — every route now shows dynamic and the build
     still succeeds, since nothing touches the DB until request time.
  2. The homepage redirected to `/sourcing/watch-list` — a leftover from
     before the redesign made Dashboard the real entry point. Now lands
     on `/desk/deals`.
  3. **File uploads were 500ing in production** — `lib/storage.ts` wrote
     to local disk, which doesn't work on Vercel's read-only serverless
     filesystem. Swapped to Supabase Storage (falls back to local disk
     automatically when running without the Supabase env vars, so local
     dev is unaffected) — same function signatures, so none of the 4
     files/6 call sites that upload or read documents needed to change.
     Verified the local-disk fallback with a real upload round-trip
     (Playwright); the Supabase Storage path itself needs the bucket +
     service role key from "Scaffolded, not wired up" below before it can
     be verified against real credentials.
- **Redesign pass matching Claude Design** — ten concrete changes, all
  verified via tsc/eslint/build and a Playwright run against a real
  `next start` server (checklist toggles, sort, nav collapse, month filter,
  appointment scheduling all exercised end-to-end, test data cleaned up
  after):
  1. Board card: the credit-grade badge now sits right next to the
     customer's name, and a new bank icon (only shown once a lender's
     chosen) sits beside it. The "Also remaining" checklist preview on each
     card is now directly checkable — no more opening the deal for a quick
     step.
  2. The board's filter control actually does something now — a dropdown
     for Newest first / Oldest first / Most urgent (urgent = red-health
     deals first), replacing the decorative "Newest first" label.
  3. Hamburger nav redesigned: six top-level sections (Dashboard, Inventory,
     Sourcing, Desk, Marketing, Lenders), each collapsed until you open it,
     instead of everything always expanded. Integrations sits below as a
     plain utility link.
  4. **Real bug fixed**: the month selector (‹ Month ›) wasn't actually
     filtering which deals showed on any tab except "All this month," and
     even that one ignored the selected month and always used today's —
     so picking October could still show September's deals. Every tab is
     now scoped to the selected month (an archived deal's month is when it
     was archived, not when the deal started).
  5. Deal modal: dropped the X button — closes on click-outside only, like
     the mockup (the click-outside behavior already existed, this was pure
     subtraction).
  6. "Schedule appointment" opens as a modal on top of the deal now instead
     of navigating to `/desk/appointments` — customer name, optional phone,
     separate date and time fields, notes, and a vehicle field that's
     either a generic body type or a specific inventory unit with
     autocomplete (new `appointments.vehicle_id` / `vehicle_body_type`
     columns, migration `0014`, applied locally and folded into
     `catchup-all.sql` — run that against Supabase when you're ready).
  7. Stips are no longer a separate checklist — they're itemized under the
     Funding stage's "Collect stips & insurance" step, which checks itself
     off once every stip is collected. Each stage (Application/Approval/
     Funding) also got its own "Check all" button, scoped to just that
     stage.
  8. Removed the History tab from the deal view. Checked for a duplicate
     Documents section — there isn't one; the credit-grade and income
     badges each have their own small upload widget for their own document
     category, which is intentional and already explained in the
     Documents card's own copy.
  9. New `components/stop-propagation.tsx` and
     `components/board-checklist-preview.tsx` — small, reusable, not
     one-off hacks.
  10. Full pass: `tsc --noEmit` clean, ESLint clean on every touched file,
      `next build` clean, Playwright smoke test (19 checks) green against a
      production build with real DB writes verified via `psql`.
- **WhatsApp messaging** — new `conversations`/`messages` tables, a `/messages`
  page (conversation list + thread + composer, matches the app's existing
  visual language), Twilio webhook at `/api/whatsapp/webhook` (signature-
  verified — rejects anything not provably from Twilio before touching the
  DB), inbound messages auto-link to a matching lead by phone number. Sending
  fails with a clear on-screen message until Twilio creds are added (see
  below) — verified this actually happens via Playwright, not just assumed.
- **UI polish pass #1** — three concrete, verified gaps, not a redesign:
  (1) modals had zero open/close animation (instant snap in/out); added a
  subtle fade+scale on both the Radix Dialog and the deal-detail route
  modal. (2) Buttons had no visible keyboard-focus state at all — added a
  focus ring. (3) Text fields' focus state was a bare border-color flip;
  added a soft glow ring (same treatment, smoother) and a real disabled
  style (was unstyled before). Also gave every accordion section on the
  deal page a smooth expand/collapse instead of an instant show/hide.
  Checked that none of this broke existing interactions (Escape-to-close,
  form submission from inside a just-expanded accordion) via Playwright.
- **VIN decoder** — "Decode" button next to VIN in Add Vehicle, uses NHTSA's
  free vPIC API (no key, no cost) to pre-fill year/make/model/trim/body
  from the VIN alone — an alternative to AutoCheck for the fields that
  don't need a real vehicle history report. **Couldn't verify this
  actually reaches NHTSA** — this sandbox's outbound proxy only allow-
  lists a handful of domains (npm, PyPI, Anthropic's APIs) and returns 403
  for everything else, NHTSA included; confirmed via a direct curl. The
  error handling path itself works correctly (verified via Playwright —
  it shows "NHTSA returned 403" cleanly, no crash), so the code is
  reachable and honest about failures, but you should try it for real
  once this runs somewhere with normal internet access before relying on
  it.
- **Analytics rebuild** — matches the reference screenshot's stat-tile layout:
  6 tiles for the selected date range (deals in range, funded, funding rate,
  commission booked, avg hours on desk, pending funding), 4 snapshot tiles
  that intentionally ignore the range picker (deals critical, stips
  outstanding, open leads, appointments set — these describe the desk
  *right now*, not a historical window; said so in a code comment so it's
  not a silent inconsistency), plus a new Inventory aging widget. Also
  upgraded "Lender performance" to use the real submission records
  (deal.subs[]) instead of just the deal's own lenderId/apr fields, which
  predates the Submissions feature and only captured one lender per deal.
  Every number here is a real Postgres query — nothing fabricated or
  AI-derived.
- **Auction watch-list**: added the editable "target gross / down payment /
  holding cost" bar at the top (matches the reference screenshot), same
  settings row the Auction day page already edited — this just gives it a
  second, more contextual home. Auto-saves on blur; verified the value
  actually lands in Postgres via a direct query, not just the UI updating.
- **Google Calendar sync** — new `/settings` page (Integrations section) with
  a real OAuth connect flow (`/api/integrations/google/connect` →
  Google's consent screen → `/api/integrations/google/callback` stores the
  tokens). Scheduling an appointment now attempts to create the matching
  Google Calendar event (best-effort — a disconnected/failed sync never
  blocks scheduling, verified via Playwright with no Google creds present);
  canceling one deletes the remote event. Appointments already had a
  `googleCalendarEventId` column from an earlier session, unused until now.
- **Warranty & F&I product database** — new `/warranty` page to manage the
  product catalog (name, provider, cost/sell price, term, deductible,
  vehicle age/mileage/sale-price eligibility caps). A new "Warranty & F&I
  match" button on every deal page (next to Lender & vehicle match) runs
  `lib/warranty-match.ts` against that catalog and the deal's actual
  vehicle/trade numbers — same deterministic, no-AI house style as the
  lender matcher: eligibility (age/mileage/price caps) is a hard pass/fail,
  and GAP/VSC get a "Recommended" flag with a plain-English reason (thin
  or negative equity for GAP; vehicle likely past a typical factory
  warranty for VSC) that's always shown, never asserted silently. This
  is advisory only — it doesn't write into the deal's own warranty/gapIns
  fields, since there's no reliable way to split the deal's single
  combined `backEndCost` between two products without guessing; you still
  enter the deal's own back-end numbers by hand.
- **Deal Copilot** — chat button on every deal page. Calls the Anthropic
  API with a real context block built from that deal's vehicle, credit/
  income facts, live lender-program match results, and eligible F&I
  products — same numbers you'd see in the other two match tools, not a
  fresh guess. Idle with a clear "Not connected yet" message until
  `ANTHROPIC_API_KEY` is set (see below) — verified that gating actually
  shows via Playwright, same as every other credential-gated feature this
  session.
- **WhatsApp sold automation** — hooked into the funding checklist's last
  step (`toggleDealStep`, only on the false→true edge, never on every
  toggle or on un-funding). Three things happen, each independently
  logged to the deal so one failing never blocks the others: (1)
  `firstPaymentDate` defaults to funded date + 30 days if you haven't
  already set one by hand (still editable in Customer facts); (2) a lead
  with a matching phone number gets flipped to `sold`; (3) the customer
  gets a WhatsApp text with their first payment date and lienholder
  (their lender's name). Needs a phone number on the deal — added a Phone
  field to New Deal and Customer facts for this. No phone on file, or
  WhatsApp not connected yet? It skips that step and says so in the deal's
  activity log instead of failing silently — verified end-to-end with a
  disposable test deal (funded it, watched the lead flip to sold, watched
  the honest "WhatsApp isn't connected yet" log line appear, cleaned
  everything up after).
- **WhatsApp referral message** — "Send referral message" button on a
  funded deal's header, next to the Funded badge. One tap sends the
  customer a fixed $200-per-referral message to their phone on file;
  logged the same way as the sold message. Kept this manual (not
  automatic) since you didn't say when it should go out, and a message
  about referral money feels like something you'd want to time yourself.
  Say the word if you'd rather it fire automatically alongside the sold
  message.
- **Modal recentering flash, fixed** — every dialog in the app (Lender
  match, Warranty match, Deal copilot, etc.) shared one component that
  centered itself with a transform that fought with its own open
  animation, which is what caused the "opens off-center, then snaps"
  glitch you flagged. Switched to flexbox centering — pure layout, so it
  can't be knocked off by the animation. Verified by sampling the dialog's
  position across the whole open animation; it stays dead-center now.
- **Auction watch-list: AutoCheck upload + manual "Add unit"** — each unit
  on the watch-list now has an AutoCheck tab (upload, AI read, delete —
  same flow as the deal page's documents). Also added a real "Add unit"
  form, since the empty state promised "add one directly" but that path
  never actually existed until now — it reuses the exact same
  `addToWatchList` logic Run list already calls.
- **Daily desk brief** — `/settings` has a new Notifications card: your
  WhatsApp number and/or email, plus a "Send test brief now" button. Once
  a day (see cron setup below), it sends what's due today: today's
  appointments, deals in red health with why, open stips count, open
  leads count — the same numbers as the Analytics snapshot row, just
  pushed to you instead of waiting for you to open the app. Either
  channel can be left blank to skip it; nothing sends until you fill in
  at least one and the matching integration (WhatsApp/email) is
  connected.
- **Post-sale check-in sequence (30/60/90 day)** — fully automatic, no
  button. The same daily job checks every funded deal's `fundedOn` date;
  the day it crosses 30/60/90 days out, the customer gets a fixed
  check-in text (90-day one includes your Google review link if you've
  set one in Settings). Tracked per-deal so it only ever sends once per
  milestone, even if the job runs twice in a day. Uses the phone number
  already on the deal — same field the sold/referral messages use.
- **Facebook/Instagram Lead Ads webhook** — receives Meta's lead
  notifications, fetches the real name/phone/email via the Graph API, and
  creates a `leads` row with source "Facebook/Instagram Lead Ads."
  Signature-verified (rejects anything not provably from Meta) and
  deduplicated (a retried webhook delivery can't create the same lead
  twice). **Couldn't verify a live lead flowing through** — this sandbox
  blocks outbound calls to graph.facebook.com the same way it blocked
  NHTSA earlier, so I could only confirm the verification handshake,
  signature check, and dedup logic directly (all pass) — the actual
  Graph API fetch needs testing from somewhere with normal internet
  access, or just by connecting a real Meta app and watching a real lead
  land.
- **Task/reminder system** — new `/desk/tasks` page (nav: Desk → Tasks):
  add a task, optionally with a due date and optionally tied to a deal.
  Bucketed into Overdue / Due today / Upcoming / No due date, plus a
  "Recently completed" list you can glance at (no undo button, but you
  can always re-add). Every deal page also got its own "Tasks" accordion
  section — same underlying table, just filtered to that deal, so a
  reminder like "call lender by Thursday" can live right where the deal
  is instead of a separate list. Tasks due today or overdue now also
  show up in the daily desk brief (WhatsApp/email), same as appointments
  and stips. Verified the full loop via Playwright: add, bucket
  correctly by due date, toggle done, and cross-linking between a deal's
  own Tasks section and the global Tasks page.
- **Round 7:**
  1. TurboPass income breakdown — the AI now transcribes every
     transaction instead of summarizing, and a deterministic module
     (`lib/turbopass-analysis.ts`, never the AI's own arithmetic) groups
     payroll by holder, separates Zelle/cash-deposit/other, excludes
     transfers from someone sharing the account holder's last name, and
     splits payroll by person when more than one holder or income source
     is on the account. Shows as a real breakdown in the income modal
     instead of a flat "Total monthly income: —".
  2. Buttons everywhere now show real hover/press feedback (color
     change, cursor, a slight press-down) — previously only custom
     checkboxes had `cursor: pointer` at all, and most buttons had no
     active state.
  3. **Bank/income badge on the dashboard** — it only ever showed once
     you opened a deal; now it's on the board cards next to the credit
     grade badge, same green/verified-or-gray as before.
  4. **Fixed: clicking either badge on a dashboard card sometimes
     navigated to the full deal page instead of opening its dialog** —
     both were real `<button>`s nested inside the card's link, which is
     invalid HTML and made click handling unreliable. Restructured so
     the link sits behind the card's text (click-through via
     `pointer-events`) instead of wrapping the badges.
  5. **Deal modal felt laggy** — clicking a deal card had no loading
     state, so nothing appeared until all 8 of the deal page's queries
     resolved. Added `loading.tsx` to the modal routes: an instant
     skeleton now shows immediately (measured ~30ms vs. ~350ms+ of
     nothing before), and it lets Next.js prefetch the modal as cards
     scroll into view. Also trimmed the Postgres connection pool
     settings for less overhead on a cold serverless request.
  6. **Lenders: rep phone field + grid layout.** New `lenders.rep_phone`
     column (separate from the existing free-text "contact" field),
     shown as a tap-to-call link on each card. The page now lays lenders
     out in a grid (like the mockup) instead of one stacked column.
     **This one needs a step from you**: the new column only exists in
     your local database so far — paste `schema-sketch/migrations/catchup-all.sql`
     into the Supabase SQL Editor and run it (same one-time step as past
     rounds; safe to re-run, every statement skips what's already there)
     before rep phone will save without erroring in production.
- **Round 8:**
  1. Fixed the Round 7 pool-size regression (see the Round 8 summary
     above) and made the whole deal card clickable, not just the
     customer-name block.
  2. Louisiana out-of-state calculator (nav: Tools, above Lenders) —
     `lib/louisiana-out-of-state-tax.ts` has the formula and every default
     fee, each one transcribed from a real ATC quote (comments in that
     file cite which quote). Lafayette and Jefferson parish rates are
     built in; any other parish needs its real rate entered by hand — it
     deliberately never guesses one. Tell me the parish + rate whenever
     you get a new ATC quote and I'll add it as a preset.
  3. WhatsApp's "ContentSid Required" error now explains itself instead
     of showing raw Twilio text — see the WhatsApp section below for what
     it actually means (a Meta policy, not a bug) and what fixes it.
  4. **Nav + Home dashboard rebuild.** The sidebar is now an always-on
     icon rail (Deals/Inventory/Sourcing/Desk/Marketing/Tools/Lenders,
     plus Home and a gear-icon Settings) instead of a hamburger-toggle
     drawer — click an icon and its subcategories flyout next to it, like
     DealerCenter. The app now opens to a real Home dashboard: a
     Quicklinks card (new deal, add a vehicle, new lead, out-of-state
     calculator, schedule appointment, settings) plus Customers/
     Inventory/Appointments summary cards with real numbers. Integrations
     moved off the old menu onto its own Settings tab. The deals board
     (your old landing page) still exists at its own "Deals" icon —
     nothing there changed except its top tab, which used to confusingly
     say "Dashboard" and now says "Working."
  5. **AI-generated marketing listings, one per vehicle.** New tab on
     Marketing (the old channel-performance report moved to a second tab
     alongside it) — every vehicle in inventory shows up automatically,
     no separate "add to marketing" step. Pick a platform (Facebook
     Marketplace / Facebook post / Instagram caption / TikTok caption)
     and a language, hit "Write the listing," edit before you post, mark
     it posted, or log a lead straight from that vehicle (creates a real
     lead, pre-filled with the vehicle's make/model). A few hard rules
     are baked into every generated listing, not left to the AI's
     judgment:
     - Down payment is a fixed formula
       (`lib/marketing-copy.ts:downPaymentCentsFor`), never left to the
       AI to guess: sedans start at $2,000 ($2,500 if 2023+), SUVs at
       $2,500 ($3,000 for a big 3-row like a Tahoe/Suburban — new
       `vehicles.is_three_row_suv` field), trucks at $3,500 ($5,000 for a
       diesel truck 2021+ — new `vehicles.fuel_type` field, since
       guessing "diesel" from the model name was too risky for a number
       that goes straight into a customer-facing ad). Vehicles need a
       body type set before a listing can be written — the panel prompts
       for it inline if it's missing (covers vehicles added before this
       feature, or bulk-imported via CSV, where fuel type/3-row status
       default to gas/no and may need a manual fix).
     - Always states that exact figure, always phrased "starting from" /
       "desde" — never a flat amount.
     - Never mentions title status or condition history (salvage, flood,
       insurance-loss, etc.) and never mentions mileage, in any language.
     - Requirements are always exactly: ID (passport explicitly
       accepted — worded so passport-only leads aren't told they don't
       qualify, per your call on that), proof of income, the down
       payment, and an open bank account. Doesn't claim SSN, credit, or a
       license are or aren't required — dropped "sin licencia" from your
       old template on purpose, given the new Texas registration law you
       mentioned.
     Verified the down-payment formula against all 9 combinations
     (sedan/suv/3-row-suv/truck/diesel-truck × the year cutoffs) and the
     full flow end to end against a real Postgres — add vehicle → shows
     up in Marketing immediately → body-type prompt → manual edit →
     persists on reload → copy → mark posted → status pill → log a lead
     (confirmed the real lead row) → sold vehicle's status pills lock.
     Couldn't test the actual AI writing here — no `ANTHROPIC_API_KEY` in
     this sandbox, same limitation as Deal Copilot and document
     extraction — confirmed it fails gracefully with a clear message
     instead of crashing; the real output only gets exercised once the
     key is live. **Needs the same Supabase step as rep phone above**:
     `catchup-all.sql` adds the new `marketing_posts` table and three
     `vehicles` columns (`fuel_type`, `is_three_row_suv`,
     `marketing_status`) — nothing here works in production until that
     runs.
- **Round 9:**
  1. Removed the "All this month" tab from both the nav flyout and the
     deals board — it duplicated the month strip already sitting above
     the board (‹ Month › with its own total), so it was one more tab
     that didn't add anything.
  2. **Standalone PTI calculator** (nav: Tools, next to the out-of-state
     calculator) — same payment-to-income formula the deal page already
     used, refactored into `ptiCalc()` taking plain inputs instead of a
     full deal row, so it works with or without a deal attached.
     Confirmed the existing deal-bound caller behaves identically after
     the refactor.
  3. **Stage checklist redesign** to match a mockup you sent: numbered
     circular badges per stage, a "Next: <step>" subtitle, circular
     checkmark icons instead of square checkboxes, and pill-shaped
     "Check all" buttons — same underlying data, purely a visual rebuild
     of the existing `AccordionSection` primitive (extended with
     optional badge/trailing slots rather than forked, so its other 5
     callers elsewhere in the app are untouched).
  4. **Auto-check on document upload** — uploading a credit report now
     checks "Pull credit" and uploading a TurboPass now checks "Verify
     income" immediately, without waiting on (or needing) AI extraction
     to succeed — getting the document is what the step means, whether
     or not extraction is configured. Never un-checks a step that's
     already done.
  5. **Insurance verification** — new shield-icon badge next to the
     credit-grade and income badges, both on the board cards and inside
     a deal, gray until a declarations page is uploaded and analyzed,
     green once it checks out, red the moment something doesn't match
     (click it for exactly what's wrong). Everything it checks is a
     fixed rule from you, never left to the AI to judge — the AI only
     transcribes what's on the page (`lib/extraction.ts`'s insurance
     prompt); `lib/insurance-verification.ts` does the actual matching:
     - Lienholder name on the declaration has to match the lienholder
       name you enter on the deal (new field, right in the badge), and
       that lienholder's address (pulled from its matching row in
       Lenders) has to match too.
     - Comprehensive and collision deductibles each have to be at or
       under that lender's max-deductible figure — new field on each
       Lenders row, defaults to $1,000, raise it per-lender for anyone
       who allows more (e.g. Veros at $1,500, per what you said).
     - The deal's customer has to be listed as a driver on the policy.
     - The vehicle being financed has to be on the policy, matched by
       VIN.
     Verified end to end against a real Postgres and a real `next start`
     build: seeded a matching declaration (all 4 checks pass) — badge
     green on both the board and the deal page, dialog shows "Verified,"
     lienholder field pre-filled; then seeded a mismatched one (deductible
     over Veros's $1,500 limit, wrong lienholder address, driver not
     listed) — badge red in both places, dialog lists all three issues
     with the exact numbers/names that didn't match. Also confirmed the
     credit/income auto-check (item 4 above) via a real upload through
     the UI, not just reading the code. All test data cleaned up after.
     **Couldn't test the live AI reading a real declarations page** — no
     `ANTHROPIC_API_KEY` in this sandbox, same limitation as Deal Copilot,
     marketing copy, and every other AI-extraction feature this session;
     the matching logic itself (the part that actually decides pass/fail)
     is fully verified against seeded extraction data shaped exactly like
     what the AI returns for every other document category. **Needs the
     Supabase migration** — see the Round 9 note at the top of this file.

---

## Scaffolded, not wired up

### Supabase Storage (file uploads)
Needed now that you're deployed — without this, every upload (TurboPass,
credit report, credit app, insurance, AutoCheck) will 500 in production:
1. In your Supabase project → **Storage** → **New bucket**. Name it
   `documents`, and set it **Private** (not public) — uploads include
   credit reports and title scans, and the app already gates every read
   through its own `/api/documents/[id]/file` route, so the bucket itself
   never needs to be public.
2. In Supabase → **Project Settings → API**, grab the **Project URL** and
   the **service_role** secret key (not the `anon` key — the service role
   key is what lets the server write to a private bucket on your behalf).
3. Add to Vercel's environment variables:
```
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```
4. Redeploy (or just re-invoke — env var changes apply on the next
   request without a full rebuild, but doing a redeploy is the safest
   way to be sure). Uploads go to Supabase Storage from then on.

Local dev doesn't need this — `lib/storage.ts` falls back to writing into
a local `uploads/` folder when these two vars aren't set, so `npm run dev`
keeps working with zero extra setup. Only production needs it.


### WhatsApp (Twilio)
Add to `.env.local`, then point your WhatsApp sender's webhook (Twilio
console → Messaging → WhatsApp senders) at `https://<your domain>/api/whatsapp/webhook`:
```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+1...
```
Get these from console.twilio.com. For testing before you have a verified
WhatsApp Business sender, Twilio's WhatsApp sandbox works with the same env
vars. Once set, `/messages` starts working end to end — nothing else to build.

Built with plain `fetch()` against Twilio's REST API, not the `twilio` npm
package — didn't want to add a dependency I couldn't exercise without your
credentials. Easy to swap in the SDK later if the raw HTTP feels thin.

**"WhatsApp needs an approved message template..." error when sending**:
this isn't a bug — it's Meta's own policy for WhatsApp Business, not
something this app controls or can work around. Free-form text (what
`/messages` sends today) only works as a *reply*, within 24 hours of the
other person's last message to you. Starting a brand-new conversation, or
messaging someone again after 24 hours of silence, requires a pre-approved
Message Template — Twilio calls it a "ContentSid." To send outside that
window: Twilio Console → Messaging → Content Template Builder, create a
template, submit it to Meta for approval (usually fast, sometimes up to a
day), then this app would need the approved template's SID wired in
(not built yet — ask if you want it). Until then, this app's outbound
WhatsApp (sold automation, referral message, daily desk brief, post-sale
check-ins) works reliably for anyone who's messaged you within the last 24
hours, and will hit this same error for anyone who hasn't.

### Google Calendar
1. In [console.cloud.google.com](https://console.cloud.google.com), create
   a project (or use an existing one), enable the "Google Calendar API",
   then create an OAuth client ID (Credentials → Create Credentials →
   OAuth client ID → type "Web application").
2. Add an Authorized redirect URI: `https://<your domain>/api/integrations/google/callback`.
3. Add to `.env.local`:
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://<your domain>/api/integrations/google/callback
```
4. Go to Settings in the app and click Connect. That's the whole flow —
   the callback route stores the tokens and refreshes them automatically.

This assumes one Google account/calendar for the whole dealership — see
"Needs your call" above if that's not what you want.

### Deal Copilot (Anthropic)
Add to `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-...
```
Get this from [console.anthropic.com](https://console.anthropic.com). That's
the whole setup — the "Deal copilot" button on every deal page starts working
the moment this is set, no other config or restart-specific step needed. This
is the same env var document extraction (`lib/extraction.ts`) already uses,
so if you've set it up for that, Deal Copilot is already live.

### Email (Resend) — for the daily desk brief
Add to `.env.local`:
```
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=brief@yourdomain.com
```
Sign up at [resend.com](https://resend.com), verify a sending domain (they
walk you through the DNS records — takes a few minutes, not instant), then
grab an API key. `RESEND_FROM_EMAIL` has to be an address on that verified
domain. If you'd rather only use WhatsApp for the desk brief, skip this
entirely — it's optional per-channel in Settings.

### Daily desk brief + post-sale check-ins — the cron schedule
Both run off one Vercel Cron job (`vercel.json`), which only takes effect
once this is deployed on Vercel — nothing to do locally beyond testing with
the "Send test brief now" button in Settings. It's currently set to run at
13:00 UTC every day (roughly 7-8am US Central/Eastern depending on the time
of year — cron doesn't auto-adjust for daylight saving, so the hour will
drift by one twice a year; edit the `schedule` string in `vercel.json` if
you want it pinned tighter). Recommend also setting a `CRON_SECRET` env var
in Vercel (any random string) — Vercel sends it automatically as a bearer
token on cron-triggered requests, and the route rejects anything else once
it's set, so nobody else can trigger your desk brief by finding the URL.

### Facebook/Instagram Lead Ads webhook
This one has more setup than the others since it's a full Meta developer
flow, not just an API key:
1. Create a Meta app at [developers.facebook.com](https://developers.facebook.com)
   (or use an existing one), add the "Webhooks" product.
2. Under Webhooks → Page, subscribe with callback URL
   `https://<your domain>/api/leads/meta/webhook`, and pick any string as
   the verify token — you'll use the same string for `META_WEBHOOK_VERIFY_TOKEN`
   below. Subscribe to the `leadgen` field.
3. Your Facebook Page needs to be connected to a Lead Ads form for this to
   ever fire — if you don't already run Lead Ads, this webhook has nothing
   to receive.
4. Get a Page access token with `leads_retrieval` permission (Graph API
   Explorer is the fastest way to generate one, or your app's own token flow).
5. Add to `.env.local` (and Vercel's env vars for production):
```
META_APP_SECRET=...          (App Settings → Basic)
META_PAGE_ACCESS_TOKEN=...   (step 4 above)
META_WEBHOOK_VERIFY_TOKEN=... (whatever string you picked in step 2)
```
**Couldn't verify a live lead end to end** — see "Done this session" above.
The code path is right (verified the handshake, signature check, and
duplicate-prevention directly), but the actual "Meta sends a real lead,
Graph API returns real field data" round trip needs a live Meta app to
confirm.

---

## Ideas for later — "one-stop-shop" feature brainstorm

*(not started — for discussion, updated as I think of more)*

**Lead generation / intake**
- ~~Facebook/Instagram Lead Ads webhook~~ — built this round, see "Done
  this session." Needs your Meta app setup to actually receive anything.
- A public "trade-in value" or "get pre-qualified" landing page that writes
  straight into `leads` — cheap lead magnet, no third party needed.
- Website chat widget → WhatsApp handoff, so a website visitor and a
  WhatsApp contact are the same lead record, not two.

**Organization / calendar**
- Google Calendar two-way sync (scaffolding this session — see above).
- ~~A daily "desk brief"~~ — built this round, see "Done this session."
- ~~Task/reminder system independent of appointments~~ — built this
  round, see "Done this session."

**F&I**
- ~~E-sign integration~~ — you said no, not needed. Not building this.
- ~~Reserve/participation tracking per funded deal~~ — you said not
  necessary. Not building this.
- Rate-sheet ingestion — if a lender emails a rate sheet PDF instead of
  updating their program in Lenders manually, AI extraction (already have
  the pipeline) could parse it into `lender_programs` automatically. Not
  started — flag if you want it.

**Inventory / sourcing**
- KBB/MMR API integration for book value instead of hand-entering it —
  needs a paid API key from you. (You asked about JD Power specifically —
  their pricing isn't public, quote-based, and the one number I found
  ($1,335/mo for 1,000 valuations) is sized way past a sub-10-units/month
  operation. Worth a call to their sales line if you want a real quote,
  but I wouldn't expect a small-dealer tier.)

**Customer-facing**
- A simple customer portal (magic-link, no password) to check application
  status / upload documents themselves instead of texting you a photo.
- ~~Post-sale check-in sequence (30/60/90 day)~~ — built this round, see
  "Done this session." Turned out not to need the AI-reply decision after
  all — it's a fixed-template send, same pattern as sold/referral, not
  an AI-drafted one.

**Ops**
- Multi-user support — right now this is single-operator (no login,
  `settings` is one row). If you want other F&I people or salespeople using
  this, that's a real auth/permissions project, not a quick add — flag if
  that's actually needed.
