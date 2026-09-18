# Turbopass message approval checklist

_Started 2026-09-14 22:05 UTC_

---

## User

Continuing from "PTI calculator trade-in toggle".

## Assistant

We've been building a deal-management system with lender guidelines, vehicle sourcing, and lead tracking. The core focus has shifted to income verification and approval workflows.

Recent work centered on the PTI calculator and income verification. We added a toggle for open auto payments — when enabled, it excludes that payment from PTI math, down-payment calculations, and lender match (including Westlake's 17% and Veros' 20% auto-share rules). The toggle sits directly under the "Open auto payment already committed" row.

We then built a bank statements upload module under the existing Turbopass income source. It accepts up to three statements in a single upload (multi-select file picker), lets you append statements one at a time to a list with remove buttons, and runs analysis on all of them together. The parser identifies multiple account holders, separates payroll by person and employer, groups Zelle transactions by sender, and automatically excludes same-last-name senders from the baseline (relating them to the primary applicant). The parsed income feeds the same selection UI, PTI calculation, lender match, and health alerts as Turbopass. When both sources exist, a switch appears to choose which one drives the deal.

Current state: All changes are live in Deal Desk v2.dc.html. The bank statements upload is now fully functional with multi-file capability and persistent stacking.

The Organic design system file you provided is loaded but not yet visually applied to the interface — the tool still uses its existing Inter Tight typography and blue-accent styling.

Open next steps: Should we apply the Organic design tokens to the interface, or continue refining logic and workflows first?

[files changed: Deal Desk v2.dc.html]

## User

When I approve a message of the turbopass not matching it should check off the verify income item in the checklist

## Assistant

_[tool: grep]_

_[tool: read_file]_

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

Approving the name-mismatch alert now also ticks "Verify income" in the checklist. Reopening the alert leaves the tick in place — say the word if you want it to un-tick too.

## User

Look over the entire project so far, see the functionalities that I've implemented and see what fuctionalities are missing, what connections should be added, and what features would benefit the app as a whole. Give me a detailed list of your findings and why they should be implemented and I'll decide what to add

## Assistant

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

Read through the whole file. Here's what I found, grouped by how much it hurts.

## Connections that are broken or fragile today

**1. Deals link to inventory by text, not by id.** `dealFacts` resolves a deal's vehicle by lowercasing `deal.vehicle` and matching `year make model` exactly (or as a prefix). Your own seed data breaks it: `"2024 Silverado LT"` never matches `Chevrolet Silverado`, and trim is not in the label at all. When the match fails, `price` falls back to `deal.price` (usually empty) — so PTI, LTV, amount financed, down-payment advice and the entire lender match silently go blank and say "no price yet." Leads already do this correctly with `vehicleId` + a picker. Deals should use the same pattern: a unit picker on the deal that stores `vehicleId`, with the text field as a fallback.

**2. Nothing marks a unit as sold or reserved.** A vehicle can be on three deals at once and still show in Marketing as "Ready to post," still count in inventory age reports, still be offered by the copilot's vehicle finder. Linking a deal to a unit should set a `Reserved`/`Sold` state on the vehicle, and funding the deal should pull it out of active inventory.

**3. Uploaded documents don't satisfy stips.** Stips are a fixed four (`POI, POR, Turbopass, Insurance`) cycled by hand. Meanwhile the app already knows a Turbopass report is on file, that income is verified, that a credit app with an address was parsed. The "Turbopass" stip should flip to Received on upload, POI on income verification. Right now you can have a verified deal whose stip list still says everything is needed.

**4. Stips aren't driven by the lender.** Your lender rules already carry `poiReq`, `porReq`, `turbopassReq`, `licenseReq`, `ssnReq`. The stip list ignores them. Once a lender is chosen, the checklist should be generated from that lender's requirements — that's the difference between a generic to-do and a real stip sheet.

**5. Analytics' lender scoreboard is fiction.** `lenderPerf` counts submissions and approvals by looking at deals whose single `lender` string equals that lender's name and whose `done.submit`/`done.approval` flags are set. So a deal submitted to four banks and approved by one records as one submission, one approval, for whichever name happens to be in the field. Same for "Leads by source → Sold," which depends on someone manually setting a lead to `Sold` — nothing does that when its deal funds.

## Missing functionality

**6. No record of what lenders actually said.** This is the biggest hole. The app is very good at predicting which lenders *fit* (rule-by-rule evaluation, why-drawers, down-payment requirements per bank) and has no place to record what happened after you hit submit: which banks got the deal, what came back, approved advance, approved payment, tier, rate, term, required down, stips they attached, decline or counter reason. Everything downstream — the scoreboard, "sitting over two days without an approval," the next-action engine — is guessing from two booleans. A submissions table on the deal (one row per lender, status + terms) would make the analytics real and close the loop on the match screen.

**7. Approval terms never feed back into the math.** PTI and down-payment advice run on a FICO-derived APR (`GRADE_APR`) and a hard-coded 66-month term. Once a bank approves at a real rate, term and advance cap, those numbers should re-derive from the approval, and the desk should show the delta between the structure you asked for and the one you got — that gap is where the deal gets re-worked or dies.

**8. No deal financials beyond a commission field.** There's `commission` and `profit` as free-text inputs. No selling price, trade allowance, trade payoff, doc fee, tax, warranty, GAP, or back-end gross. So "Profit" in the month header and Analytics is a number someone typed, not a number the deal produces. Given you already have vehicle `cost`, `price`, and a `PACK` constant on the sourcing side, front-end gross is computable — it just isn't.

**9. No trade-in on the deal.** You have an `openAutoTradeIn` toggle that excludes a payment from PTI, which implies a trade exists, but there's nowhere to record the trade vehicle, its ACV, or its payoff. Negative equity is the single most common reason a structure fails, and the app can't see it.

**10. Nothing is ever archived.** Deals are month-filtered but never closed out; funded deals stay in the working list forever and keep their live timer running. Same for the auction watch-list: units go to inventory or get deleted, with no record of what you bid and lost, so there's no feedback loop on your bid math.

**11. No tasks or reminders on a deal.** Leads have follow-up dates and appointments; deals have a timer and health alerts. There's no "call the bank Thursday" on a deal, and no single place that shows today's work across both leads and deals — the Priority queue only covers deals.

**12. Stored analysis is never re-run or versioned.** A credit report, Turbopass, or AutoCheck is parsed once and cached. If a customer comes back in three weeks, there's no re-pull, no comparison against the old read, no "this report is 40 days old" staleness flag — even though stale POI is a real funding problem.

## Features that would pay off

**13. Deal recap / sheet output.** Everything needed for a one-page summary already exists — applicant, credit facts, verified income with sources, PTI math, structure, lender match with reasoning, stips. A printable recap would make the desk's work portable to the sales floor and the bank, and you already have print-ready document scaffolding available.

**14. Search.** Nine sections, all filtered by tab and month, and no way to type a name, stock number, or VIN and jump to it.

**15. Export / import of all data.** Everything lives in five localStorage keys with no backup. One bad browser clear wipes the lenders you've spent real time entering. A JSON export/import — or at minimum a lender-guidelines export — is cheap insurance.

**16. An audit trail on the deal.** Who approved which health alert, when income got verified, when a lender rule changed version. You already bump `lender.version` on every edit but don't keep the history, so a deal underwritten against v3 of Westlake's sheet can't be explained later.

**17. The Organic design system still isn't applied.** The interface is Inter Tight with blue accents; the bound system is Caprasimo/Figtree on cream with terracotta and sage. That's a separate, fairly mechanical pass — worth doing in one go rather than piecemeal.

My own ranking if you want one: 1, 6, 3 first (they make existing features actually work), then 7, 8, 9 (they make the money side real), then 13 and 14.

## User

Implement all of them

## Assistant

_[tool: update_todos]_

Seventeen items in a 6,500-line file — I'll work in batches and deliver after each. Starting with the data-model spine (1, 2, 9, 8, 6, 7) since they interlock. Reading the deal detail panel first.

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

Batch 1 — the data-model spine. Applying logic changes first.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

Batch 2 — stips, evidence and history (items 3, 4, 16).

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

Batch 3 — real analytics, archiving, document staleness.

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: update_todos]_

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

Both fixed: the down row now reads "$500 short", and the PTI footnote names its real rate source instead of claiming a default.

Thirteen of seventeen are in:

**Connections** — deals link to units by id with a confirm/unlink chip and a warning when the unit is on someone else's deal; units carry derived Reserved/Delivered/Sold badges and sold units drop out of the vehicle finder; uploads auto-clear their own stips with a note saying which document did it; missing stips the banks require appear as one-tap chips; analytics now counts real submissions (with a Look column and average approved rate) and a funded deal closes out its lead.

**Money** — approval terms drive PTI and down-payment advice, with a structure-delta panel showing where the deal sits against the approved advance, payment and down; a Money & trade section with selling price, fees, products, trade ACV/payoff, negative-equity handling, amount financed and front/back/total gross.

**Also** — a Submissions section recording each bank's decision and terms, an append-only History on every deal (including which guideline version a submission went out against), staleness alerts on reads over 30 days, and an Archived tab.

Remaining: tasks/reminders with a unified today view, printable recap, global search, export/import, and the Organic restyle. I've hit the usage limit for now — say the word and I'll pick up with those.

