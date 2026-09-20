# Working notes — autonomous session

Started while you were away, per your instruction to keep improving the app,
scaffold WhatsApp + Google Calendar, brainstorm a "one-stop-shop" feature set,
and do a UI polish pass. Nothing here is pushed to GitHub — local commits only,
on `main`, so you can review the diffs before deciding what to push.

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

- **AI auto-reply on WhatsApp** — you asked for "an agent to message customers
  that reach out." I built the messaging infrastructure (conversations,
  send/receive, webhook) but deliberately did **not** wire up an AI that
  auto-replies to customers unsupervised. Two real reasons, not me being
  timid: (1) an LLM improvising about pricing, approval odds, or payment
  numbers to a real customer over WhatsApp is a liability problem if it
  gets something wrong — dealership compliance stuff, not a coding
  question I can answer for you; (2) TCPA — texting customers (WhatsApp
  counts) generally needs documented consent, and I don't know what your
  current consent capture looks like. Tell me when you're back: should the
  agent (a) draft replies for a human to approve before sending, (b) only
  auto-reply to a narrow whitelist of questions ("what are your hours,"
  "is the F-150 still available"), or (c) something else? I'll build
  whichever once you pick.
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
- **Google Calendar sync** — new `/settings` page (Integrations section) with
  a real OAuth connect flow (`/api/integrations/google/connect` →
  Google's consent screen → `/api/integrations/google/callback` stores the
  tokens). Scheduling an appointment now attempts to create the matching
  Google Calendar event (best-effort — a disconnected/failed sync never
  blocks scheduling, verified via Playwright with no Google creds present);
  canceling one deletes the remote event. Appointments already had a
  `googleCalendarEventId` column from an earlier session, unused until now.
- *(more below as the session continues)*

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

---

## Ideas for later — "one-stop-shop" feature brainstorm

*(not started — for discussion, updated as I think of more)*

**Lead generation / intake**
- Facebook/Instagram Lead Ads webhook → auto-create a `leads` row (Meta has
  a real-time lead webhook API; needs a Meta app + page access token).
- A public "trade-in value" or "get pre-qualified" landing page that writes
  straight into `leads` — cheap lead magnet, no third party needed.
- Website chat widget → WhatsApp handoff, so a website visitor and a
  WhatsApp contact are the same lead record, not two.

**Organization / calendar**
- Google Calendar two-way sync (scaffolding this session — see above).
- A daily "desk brief" — what's due today across appointments, stips,
  follow-ups — email or WhatsApp to yourself each morning.
- Task/reminder system independent of appointments (e.g. "call lender by
  Thursday") tied to a deal.

**F&I**
- E-sign integration (DocuSign or similar) for buyer's orders / disclosures —
  real compliance surface, needs your state's specific forms, so this is a
  "needs your call" item once we get here, not something to guess at.
- Rate-sheet ingestion — if a lender emails a rate sheet PDF instead of
  updating their program in Lenders manually, AI extraction (already have
  the pipeline) could parse it into `lender_programs` automatically.
- Reserve/participation tracking per funded deal — you already track
  commission; reserve income is a natural adjacent number for the
  Analytics page.

**Inventory / sourcing**
- VIN decoder API (NHTSA's is free) to auto-fill year/make/model/trim on
  manual vehicle entry from a VIN alone, no AutoCheck needed.
- KBB/MMR API integration for book value instead of hand-entering it —
  needs a paid API key from you.

**Customer-facing**
- A simple customer portal (magic-link, no password) to check application
  status / upload documents themselves instead of texting you a photo.
- Post-sale check-in sequence (30/60/90 day) — service reminders, review
  requests — could ride on the same WhatsApp infrastructure once the
  AI-reply question above is answered.

**Ops**
- Multi-user support — right now this is single-operator (no login,
  `settings` is one row). If you want other F&I people or salespeople using
  this, that's a real auth/permissions project, not a quick add — flag if
  that's actually needed.
