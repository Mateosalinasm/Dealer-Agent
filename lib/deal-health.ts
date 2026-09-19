// Deal health issues + "next action" waterfall. Ported from the design
// prototype's dealHealth()/nextAction() (Deal Desk v2.dc.html, ~line 4460
// and ~4601).
//
// A few of the prototype's checks depend on AI-read documents (TurboPass/
// bank-statement holder-name matching, address matching, report
// staleness) that this app can't produce yet without ANTHROPIC_API_KEY —
// those are simply omitted below rather than faked; they'll come back
// once document extraction is wired up. Everything else is ported as-is.

import type { schema } from "@/lib/db";
import type { DealFacts } from "@/lib/deal-facts";
import type { ProgramMatchResult } from "@/lib/lender-match";

type Deal = typeof schema.deals.$inferSelect;

export interface HealthIssue {
  sev: "red" | "yellow";
  title: string;
  detail: string;
  key: string;
  acked: boolean;
}

export interface DealHealth {
  status: "red" | "yellow" | "green";
  label: string;
  issues: HealthIssue[];
  redCount: number;
  ackedCount: number;
}

export function dealHealth(deal: Deal, facts: DealFacts, chosenProgramMatch?: ProgramMatchResult | null): DealHealth {
  const issues: HealthIssue[] = [];
  const ack = deal.ackIssues;
  const push = (sev: HealthIssue["sev"], title: string, detail: string, key: string) =>
    issues.push({ sev, title, detail, key, acked: !!ack[key] });

  const done = deal.done;
  const openStips = deal.stips.filter((s) => !s.done);
  const hours = (Date.now() - deal.createdAt.getTime()) / 3_600_000;

  if (!facts.fico) push("yellow", "No credit report on file", "Run credit to grade the customer and match lenders.", "noCredit");

  if (facts.income != null && deal.statedIncome != null && deal.verifiedIncome != null) {
    const shortfall = deal.statedIncome - deal.verifiedIncome;
    if (shortfall >= 300) {
      push(
        shortfall >= 1000 ? "red" : "yellow",
        "Verified income is short of the application",
        `Application vs verified baseline is ${shortfall >= 100 ? Math.round(shortfall / 100) : shortfall / 100} less than stated. Needs your review.`,
        "tpShort",
      );
    }
  }

  if (!deal.vehicleId) push("yellow", "No vehicle linked", "Pick the unit from inventory so title and mileage rules can be checked.", "noVehLink");

  if (facts.vehicle && facts.vehicle.title !== "clean" && deal.idType === "Foreign passport") {
    push("red", "Title incompatible with passport", "Only some lenders work with a passport and a non-clean title.", "titlePassport");
  }

  if (chosenProgramMatch && chosenProgramMatch.status === "excluded") {
    push(
      "red",
      "Chosen bank conflicts with its guidelines",
      `${chosenProgramMatch.lenderName}: ${chosenProgramMatch.collateralStops.join("; ") || "see lender match"}`,
      "bankConflict",
    );
  }

  if (done.signoff && !done.contracts) push("yellow", "Signed off but contracts not printed", "Customer agreed to numbers — get paper signed.", "noContracts");

  if (done.contracts && openStips.length) {
    push(
      openStips.length > 2 ? "red" : "yellow",
      `${openStips.length} stip${openStips.length === 1 ? "" : "s"} outstanding`,
      `${openStips.map((s) => s.label).join(", ")} still needed.`,
      "openStips",
    );
  }

  const insuranceStip = deal.stips.find((s) => /insur/i.test(s.label));
  if (done.contracts && insuranceStip && !insuranceStip.done) push("red", "Insurance not collected", "Bank will not fund without it.", "noInsurance");

  if (deal.fundingSince) {
    const days = Math.floor((Date.now() - deal.fundingSince.getTime()) / 86_400_000);
    if (days >= 4) push("red", `${days} days in funding`, "Past the two-day mark — chase the bank.", "fundingSlow");
    else if (days >= 2) push("yellow", `${days} days in funding`, "Watch it.", "fundingSlow");
  } else if (hours > 48 && !done.approval) {
    push("yellow", "Sitting over two days without an approval", "Resubmit or call the bank.", "noApproval");
  }

  const live = issues.filter((x) => !x.acked);
  const redCount = live.filter((x) => x.sev === "red").length;
  const status = redCount ? "red" : live.length ? "yellow" : "green";

  return {
    status,
    label: status === "red" ? "Critical" : status === "yellow" ? "Attention needed" : "Healthy",
    issues,
    redCount,
    ackedCount: issues.length - live.length,
  };
}

export interface NextAction {
  label: string;
  bucket: string;
}

export interface Bucket {
  key: string;
  label: string;
  bg: string;
  fg: string;
}

export const BUCKETS: Bucket[] = [
  { key: "now", label: "Do now", bg: "var(--color-negative-bg)", fg: "var(--color-negative-text)" },
  { key: "contract", label: "Ready to contract", bg: "var(--color-info-bg)", fg: "var(--color-info-text)" },
  { key: "fund", label: "Ready to fund", bg: "var(--color-positive-bg)", fg: "var(--color-positive-text)" },
  { key: "lender", label: "Waiting on lender", bg: "var(--color-caution-bg)", fg: "var(--color-caution-text)" },
  { key: "customer", label: "Waiting on customer", bg: "var(--color-caution-bg)", fg: "var(--color-caution-text)" },
  { key: "followup", label: "Follow-up required", bg: "var(--color-fill-subtle)", fg: "var(--color-text-muted)" },
];

export function bucketOf(key: string): Bucket {
  return BUCKETS.find((b) => b.key === key) ?? BUCKETS[0];
}

/** First-match-wins waterfall down the checklist — exactly one action is ever "next." */
export function nextAction(deal: Deal, facts: DealFacts, health: DealHealth): NextAction {
  const done = deal.done;
  const openStips = deal.stips.filter((s) => !s.done);
  const mismatch = health.issues.find((x) => !x.acked && /mismatch/i.test(x.title));

  if (!done.credit) return { label: "Run credit", bucket: "now" };
  if (!facts.fico) return { label: "Upload the credit report", bucket: "now" };
  if (!done.income) return { label: "Verify income", bucket: "now" };
  if (mismatch) return { label: `Review ${mismatch.title.toLowerCase()}`, bucket: "now" };
  if (!facts.vehicle) return { label: "Find a compatible vehicle", bucket: "now" };
  if (!done.structure) return { label: "Structure the deal", bucket: "now" };
  if (!done.submit) return { label: "Submit to lender", bucket: "now" };
  if (!done.approval) return { label: "Follow up with the lender on the approval", bucket: "lender" };
  if (!done.present) return { label: "Present the numbers to the customer", bucket: "now" };
  if (!done.signoff) return { label: "Get customer sign-off on the numbers", bucket: "customer" };
  if (!done.contracts) return { label: "Print the contract and get signatures", bucket: "contract" };
  if (openStips.length) return { label: `Collect ${openStips.map((s) => s.label).join(", ")}`, bucket: "customer" };
  if (!done.stips) return { label: "Mark stips and insurance collected", bucket: "now" };
  if (!done.plates) return { label: "Assign the plates", bucket: "now" };
  if (!done.bank) return { label: "Contract with the bank", bucket: "fund" };
  if (!done.booked) return { label: "Book the deal", bucket: "fund" };
  if (!done.funded) return { label: "Follow up with the lender on funding", bucket: "lender" };
  return { label: "Funded — nothing left", bucket: "followup" };
}
