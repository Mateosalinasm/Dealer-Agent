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

---

## Scaffolded, not wired up

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
- Task/reminder system independent of appointments (e.g. "call lender by
  Thursday") tied to a deal.

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
