// Derived facts for a deal — money math, trade equity, PTI. Ported from
// the design prototype's dealFacts()/ptiCalc() (Deal Desk v2.dc.html,
// ~line 3921 and ~4348), adapted to this app's integer-cents convention
// (the prototype works in raw dollar numbers).
//
// Two deliberate deviations from the prototype, both noted inline:
//  - unitCost is computed from this schema's real hammer/buyFee/tow/recon
//    columns instead of the prototype's flat "PACK" stand-in for
//    hand-entered units (we don't have that gap — those columns are
//    populated for every vehicle, not just auction buys).
//  - ptiCalc blocks with an honest message when APR/term are unknown,
//    instead of falling back to the prototype's credit-grade default APR
//    table, which isn't reproducible here without fabricating numbers.

import type { schema } from "@/lib/db";

type Deal = typeof schema.deals.$inferSelect;
type Vehicle = typeof schema.vehicles.$inferSelect;

export interface DealFacts {
  vehicle: Vehicle | null;
  vehicleLabel: string;
  unitPrice: number | null;
  unitCost: number | null;
  sellPrice: number | null;
  down: number | null;
  income: number | null;
  docFee: number | null;
  taxAmt: number | null;
  warranty: number | null;
  gapIns: number | null;
  backEndCost: number | null;
  addOns: number;
  tradeAcv: number | null;
  tradePayoff: number | null;
  hasTrade: boolean;
  tradeEquity: number | null;
  amountFinanced: number | null;
  frontGross: number | null;
  backGross: number | null;
  totalGross: number | null;
  payment: number | null;
  openAutoPayment: number | null;
  pti: number | null;
  ltv: number | null;
  fico: number | null;
}

export function dealFacts(deal: Deal, vehicle: Vehicle | null): DealFacts {
  const unitPrice = vehicle?.askingPrice ?? null;
  const unitCost = vehicle ? (vehicle.hammer ?? 0) + (vehicle.buyFee ?? 0) + vehicle.tow + vehicle.recon : null;
  const sellPrice = deal.salePrice ?? unitPrice;
  const down = deal.cashDown;
  const income = deal.verifiedIncome ?? deal.statedIncome;

  const { docFee, salesTax: taxAmt, warranty, gapIns, backEndCost } = deal;
  const addOns = (docFee ?? 0) + (taxAmt ?? 0) + (warranty ?? 0) + (gapIns ?? 0);

  const { tradeAcv, tradePayoff } = deal;
  const hasTrade = !!(deal.tradeVehicle || tradeAcv != null || tradePayoff != null);
  // Positive equity works like more money down; negative equity gets rolled into the loan.
  const tradeEquity = hasTrade ? (tradeAcv ?? 0) - (tradePayoff ?? 0) : null;

  const amountFinanced = sellPrice != null ? Math.max(0, sellPrice + addOns - (down ?? 0) - (tradeEquity ?? 0)) : null;

  const frontGross = sellPrice != null && unitCost != null ? Math.round(sellPrice - unitCost) : null;
  const backGross = warranty != null || gapIns != null || backEndCost != null ? Math.round((warranty ?? 0) + (gapIns ?? 0) - (backEndCost ?? 0)) : null;
  const totalGross = frontGross != null || backGross != null ? (frontGross ?? 0) + (backGross ?? 0) : null;

  const openAutoPayment = deal.openAutoTradeIn ? 0 : deal.openAutoPayment;

  return {
    vehicle,
    vehicleLabel: vehicle ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") : "",
    unitPrice,
    unitCost,
    sellPrice,
    down,
    income,
    docFee,
    taxAmt,
    warranty,
    gapIns,
    backEndCost,
    addOns,
    tradeAcv,
    tradePayoff,
    hasTrade,
    tradeEquity,
    amountFinanced,
    frontGross,
    backGross,
    totalGross,
    payment: deal.payment,
    openAutoPayment,
    pti: deal.payment != null && income ? Math.round((deal.payment / income) * 100) : null,
    ltv: amountFinanced != null && sellPrice ? Math.round((amountFinanced / sellPrice) * 100) : null,
    fico: deal.fico,
  };
}

export interface MoneyRow {
  label: string;
  value: string;
  strong?: boolean;
}

export interface GrossRow extends MoneyRow {
  note: string;
}

// --- Submissions (deal.subs[]) -------------------------------------------

export type Submission = Deal["subs"][number];

/** Explicit pick, else the first approved sub, else the first non-withdrawn one. */
export function activeApproval(deal: Deal): Submission | null {
  const subs = deal.subs;
  if (deal.primarySubId) {
    const picked = subs.find((s) => s.id === deal.primarySubId && (s.status === "approved" || s.status === "counter"));
    if (picked) return picked;
  }
  return subs.find((s) => s.status === "approved") ?? subs.find((s) => s.status !== "pulled") ?? null;
}

export function dealApr(deal: Deal): number | null {
  return activeApproval(deal)?.apr ?? deal.apr;
}

export function dealTerm(deal: Deal): number | null {
  return activeApproval(deal)?.term ?? deal.termMonths;
}

// --- PTI calculator --------------------------------------------------------

export const PTI_TARGETS = [17, 20, 25];
const HOUSE_MIN_DOWN = 150_000; // $1,500, in cents

function payFactor(aprBps: number, termMonths: number): number {
  const r = aprBps / 120_000; // basis points -> monthly rate
  return r ? r / (1 - Math.pow(1 + r, -termMonths)) : 1 / termMonths;
}

export function estPayment(amountCents: number | null, aprBps: number, termMonths: number): number | null {
  return amountCents == null ? null : Math.round(amountCents * payFactor(aprBps, termMonths));
}

export interface PtiResult {
  blocked: string;
  pct: number;
  apr: number | null;
  term: number | null;
  income?: number;
  price?: number;
  existing?: number;
  allowed?: number;
  room?: number;
  maxFinanced?: number;
  requiredDown?: number;
  paymentAt?: number | null;
  down?: number | null;
  actualPayment?: number | null;
  actualPti?: number | null;
  shortfall?: number;
  ok?: boolean;
  noRoom?: boolean;
}

export function ptiCalc(deal: Deal, facts: DealFacts): PtiResult {
  const income = facts.income;
  const price = deal.ptiPrice ?? facts.sellPrice;
  const pct = deal.ptiPct || PTI_TARGETS[0];
  const apr = dealApr(deal);
  const term = dealTerm(deal);
  const existing = facts.openAutoPayment ?? 0;
  const down = facts.down;

  if (!income) return { blocked: "No income yet. Enter a stated or verified income.", pct, apr, term };
  if (price == null) return { blocked: "No price yet. Link the deal to a unit in inventory or enter a price.", pct, apr, term };
  if (apr == null || term == null) return { blocked: "Enter an APR and term (or pick an approved submission) to estimate the payment.", pct, apr, term };

  const allowed = Math.round((income * pct) / 100);
  const room = allowed - existing;
  const maxFinanced = room > 0 ? Math.round(room / payFactor(apr, term)) : 0;
  const rawDown = Math.max(0, price - maxFinanced);
  const requiredDown = Math.max(HOUSE_MIN_DOWN, Math.ceil(rawDown / 5000) * 5000);
  const financedAt = Math.max(0, price - requiredDown);
  const paymentAt = estPayment(financedAt, apr, term);
  const actualFinanced = down != null ? Math.max(0, price - down) : null;
  const actualPayment = actualFinanced != null ? estPayment(actualFinanced, apr, term) : null;
  const actualPti = actualPayment != null && income ? Math.round(((actualPayment + existing) / income) * 100) : null;

  return {
    blocked: "",
    pct,
    apr,
    term,
    income,
    price,
    existing,
    allowed,
    room,
    maxFinanced,
    requiredDown,
    paymentAt,
    down,
    actualPayment,
    actualPti,
    shortfall: down != null ? Math.max(0, requiredDown - down) : requiredDown,
    ok: down != null && down >= requiredDown,
    noRoom: room <= 0,
  };
}
