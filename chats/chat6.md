# Dealership Finance Manager App

_Started 2026-09-15 17:11 UTC_

---

## User

Continuing from "Turbopass message approval checklist".

## Assistant

We've been building a complete deal-management system with lender guidelines, vehicle sourcing, and lead tracking. The project scope expanded to cover seventeen critical gaps in connections, money flow, and analytics.

We completed the first thirteen items across four areas:

**Data model fixes** — Deals now link to inventory by vehicleId (not text matching), with a picker and unlink chip. Vehicles carry Reserved/Delivered/Sold badges and drop from the finder when sold. Trade-ins are now recordable with ACV, payoff, and negative-equity math. Deal financials expanded from just commission to selling price, trade allowance, doc fee, tax, warranty, GAP, and front/back/total gross.

**Lender-driven workflows** — Stips now auto-clear when matching documents upload (Turbopass clears itself, POI on income verify). Missing stips required by the chosen lender appear as chips. Lender rules already carried poiReq, porReq, etc. — now they drive the checklist instead of cycling four fixed items by hand.

**Real submissions and approvals** — A Submissions table records each bank's decision, approved advance, rate, term, and stips attached. Approval terms now feed back into PTI and down-payment math with a structure-delta panel showing the gap between what you asked for and what the bank approved. Analytics' lender scoreboard now counts real submissions (with a Look column and average approved rate) instead of guessing from a single lender field.

**History and staleness** — Deals carry an append-only History log (who approved alerts, when income verified, which guideline version a submission used). Credit reports, Turbopass, and AutoCheck get staleness alerts if over 30 days old. Funded deals close their linked lead automatically. Archived tab holds completed deals.

Current state: All changes are live in Deal Desk v2.dc.html.

Open: tasks/reminders with unified today view, printable recap, global search, export/import lender guidelines, and the Organic design system restyle.

[files changed: Deal Desk v2.dc.html]

## User

Go over my entire project and see what flaws you can find, see if there are any missing connections, see if there are any features that add to the experience, I want this app to be my right hand as a dealership finance manager, I want it to help me buy inventory from the auction, I want it to give me an edge when it comes to buying inventory, give me ideas for the best features for getting vehicles at the best price to maximize profit

## Assistant



## Assistant

_[tool: run_script]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

Went through the whole app. Here's what I found.

## Real flaws

**1. Converting a watch-list unit to inventory records the wrong cost.** `toInventory` writes `cost = maxCost` — your *ceiling*, not what you actually paid. Every unit you buy under your max silently understates gross, and your analytics inherit the error permanently. It should ask for the hammer price plus fees.

**2. The pack is a hard-coded $2,700 for every unit.** Target gross is editable and saved; the pack isn't. A frame-damage unit needing $3,400 of bodywork and a clean lease return get the same deduction, so your max bid is wrong in both directions.

**3. Max bid ignores the bank.** `bidMath` is only retail − pack − gross. But `vehicleBankFit` already knows each lender's `maxAdvance`, `maxLTV`, and the haircuts (Veros cuts to 80% on insurance loss, 60% on salvage). On a subprime lot the advance ceiling is often the real cap — if no active bank will advance past $14k on a unit, paying to a $16k retail model is buying a car you can't finance. The two calculations exist side by side and never talk.

**4. Nothing learns.** No record of what you bid, won, lost, or what the unit actually sold for. The appraiser guesses fresh every time even though you have real outcomes sitting in inventory and deals.

**5. Sourcing is blind to demand.** Leads carry a desired vehicle, deals carry what customers bought, inventory carries what's sitting 134 days. None of it reaches the watch-list. You can't see "three leads wanted a truck under $25k and you had none."

**6. Aging costs nothing.** Days-in-inventory is displayed but never priced. A unit you expect to sit 90 days should carry a lower max bid than one that turns in 20.

## Highest-leverage features for buying

- **True max bid** — min(retail model, lender advance ceiling), with per-unit recon, the auction's fee scale, transport by location, and a floorplan carry charge based on expected days to turn. One number you can trust standing in the lane.
- **Run-list mode** — paste or upload a whole sale's list, get every unit scored and sorted by headroom (max bid minus expected opening money), so you walk in knowing your five lanes.
- **Bid log with calibration** — record max bid, what it sold for, whether you won. Over time: "you're winning 12% of trucks, you're $1,400 light" or "you overpaid on salvage twice."
- **Demand board** — what your leads asked for that you didn't have, what segments turn fastest at what gross, what's aging. Turns your own deal history into a buy list.
- **Sold-unit scorecard** — actual gross vs. the estimate you bought on, by body style and title brand. That's the feedback loop that makes the estimator worth trusting.
- **Title-brand advance map** — for any unit, which of your active banks will finance it and at what haircut, before you bid.

Also worth noting: the app is styled in a system-blue/gray palette that doesn't match the Organic design system bound to this project. Restyling is a separate pass.

Which of these should I build first?

_[tool: ask_user]_

Waiting on your answers — especially the real cost numbers, since the max-bid math is only as good as those.

## User

Answered — priorities: True max bid (recon, fees, transport, carry, lender advance ceiling), Run-list mode — score a whole sale at once, Demand board — what your leads and deals say to buy, Sold-unit scorecard — actual gro…; auctions: Manheim, Americas Auto Auction, Insurance Auto Auction; costs: add $100 tow fee, $1000 for America Auto Auction and Mainheim, and 10% of the sale to Insurance Auto Auction; target: Flat dollar per unit; bidstyle: Live in the lane; restyle: Keep current look

## Assistant

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

Now the per-unit cost block on each watch card.

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: grep]_

_[tool: grep]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: grep]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: run_script]_

_[tool: dc_html_str_replace]_

_[tool: show_html]_

_[tool: multi_screenshot]_

_[tool: multi_screenshot]_

_[tool: multi_screenshot]_

_[tool: multi_screenshot]_

_[tool: ready_for_verification]_

Built all five. Everything's under **Sourcing** in the menu.

**True max bid** — each watch-list card now picks its house (Manheim, America's, IAA), takes a recon estimate, and solves the bid backward through the real fee. IAA's 10% scales with the bid rather than being subtracted flat, so $8,900 retail at IAA gives $5,090 max, landing at $5,699 with fee and tow. Below it, the bank ceiling: the highest advance any lender that clears the unit will write. When that caps the deal, the bid drops and the panel says which bank and by how much. Target gross and assumed down payment sit in the top bar and persist.

**Run list** — paste a whole sale sheet, get every unit read, appraised, and sorted by headroom (max bid minus what it usually brings in the lane). Banks-clearing count per row, one click to move a unit to the watch-list.

**What to buy** — leads matched against available stock (anything "not in stock" is a lead you can't close), segment table with sold count, average gross, average turn and current stock per body style, and a list of anything sitting past 75 days.

**Buy scorecard** — hammer, landed cost, the retail you bought on, what it sold for, actual gross, and the miss. Flags any unit bought over its max bid. Empty until you buy through the new flow.

**Cost bug fixed** — "Bought it" now asks what you actually paid, shows fee plus tow plus recon, and tells you whether you came in over or under your max before you commit. It stores the real landed cost along with the estimate you bought on, which is what makes the scorecard work.

One knock-on: `frontGross` was subtracting a flat $2,700 pack. Units bought through the new flow already carry fees, tow and recon in their cost, so the pack would double-count — it's now dropped for those and kept for older hand-entered units.

Two things I did not model: Veros's title haircuts (80% on insurance loss, 60% on salvage) sit in its notes as free text, so the advance ceiling doesn't apply them — worth adding as real rule fields. And there's no floorplan carry in the bid math since you didn't give me a rate.

## User

Found issues — fixing…

## Assistant

_[tool: run_script]_

_[tool: show_html]_

_[tool: multi_screenshot]_

Scrollbar is there and the columns are reachable now.

_[tool: ready_for_verification]_

Both wide tables now scroll horizontally instead of clipping — the run list's Watch button and the scorecard's "vs. plan" column are reachable at narrow widths.

## User

Make the hamburguer menu scrollable, right now I can access the sections at the bottom of the menu

## Assistant

_[tool: grep]_

_[tool: read_file]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: read_file]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

Menu panel now scrolls; the groups keep their height instead of compressing. (The design-system warning is expected — you chose to keep the current look.)

## User

relode

## Assistant

_[tool: show_html]_

