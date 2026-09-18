// The single source of truth for bid math. Every screen imports from here.
// All money is integer CENTS.

export type House = 'manheim' | 'americas' | 'iaa';

/** Buy fees by house. Flat component plus a percentage of the hammer price. */
export const HOUSE_FEES: Record<House, { label: string; flat: number; pct: number }> = {
  manheim:  { label: 'Manheim',              flat: 20000, pct: 1.5 },
  americas: { label: "America's Auto Auction", flat: 17500, pct: 1.5 },
  iaa:      { label: 'IAA',                  flat: 24500, pct: 2.0 },
};

export const TOW = 10000;
export const DEFAULT_TURN_DAYS = 45;

export function buyFee(house: House, hammer: number) {
  const f = HOUSE_FEES[house];
  return Math.round(f.flat + Math.max(0, hammer) * (f.pct / 100));
}

export function landedCost(house: House, hammer: number, recon: number) {
  const h = Math.max(0, hammer);
  return h + buyFee(house, h) + TOW + recon;
}

/**
 * Average days from acquisition to funding, from real history. Falls back to
 * DEFAULT_TURN_DAYS until there is enough of it.
 */
export function avgTurnDays(
  rows: Array<{ acquiredOn: string | null; fundedOn: string | null }>,
) {
  const days = rows
    .filter(r => r.acquiredOn && r.fundedOn)
    .map(r => Math.round(
      (Date.parse(r.fundedOn + 'T00:00:00') - Date.parse(r.acquiredOn + 'T00:00:00')) / 86_400_000,
    ))
    .filter(d => d >= 0 && d < 400);
  if (!days.length) return DEFAULT_TURN_DAYS;
  return Math.round(days.reduce((a, b) => a + b, 0) / days.length);
}

export function holdingCost(turnDays: number, perDay: number) {
  return Math.max(0, Math.round(turnDays * perDay));
}

export interface BidInput {
  house: House;
  retail: number;            // realistic retail, or the lender-capped retail if lower
  targetGross: number;
  recon: number;
  holdingCost: number;
}

export interface BidPlan {
  maxBid: number;            // walk away above this
  fee: number;
  tow: number;
  recon: number;
  holdingCost: number;
  targetGross: number;
  retail: number;
  landedAtMax: number;
}

/**
 * Solve for the bid rather than subtracting a fee, because the percentage
 * component of the buy fee scales with the bid itself.
 */
export function bidPlan(i: BidInput): BidPlan | null {
  if (!i.retail) return null;
  const f = HOUSE_FEES[i.house];
  const room = i.retail - i.targetGross - i.recon - TOW - f.flat - Math.max(0, i.holdingCost);
  const maxBid = Math.floor(room / (1 + f.pct / 100));
  return {
    maxBid,
    fee: buyFee(i.house, Math.max(0, maxBid)),
    tow: TOW,
    recon: i.recon,
    holdingCost: i.holdingCost,
    targetGross: i.targetGross,
    retail: i.retail,
    landedAtMax: landedCost(i.house, Math.max(0, maxBid), i.recon),
  };
}

/** What a lender will advance, converted into the retail the deal can actually carry. */
export function lenderCappedRetail(
  bookValue: number,
  advancePct: number,
  assumedDown: number,
) {
  return Math.round(bookValue * (advancePct / 100)) + assumedDown;
}

// ---- sale_comps reads ----

export function compKey(make?: string | null, model?: string | null) {
  return `${make ?? ''} ${model ?? ''}`.toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

export interface Comp {
  make: string | null; model: string | null;
  soldFor: number; ourMaxBid: number | null; won: boolean; observedOn: string;
}

/** What this model actually brings in your lanes. Trim and year are ignored on purpose. */
export function compStats(comps: Comp[], make?: string | null, model?: string | null) {
  const k = compKey(make, model);
  if (!k) return null;
  const hits = comps.filter(c => compKey(c.make, c.model) === k && c.soldFor > 0);
  if (!hits.length) return null;
  const prices = hits.map(c => c.soldFor);
  return {
    n: hits.length,
    avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    lo: Math.min(...prices),
    hi: Math.max(...prices),
    won: hits.filter(c => c.won).length,
    lastSeen: hits.map(c => c.observedOn).sort().pop()!,
  };
}

/** How far past your max bid the lane has been going on the ones you lost. */
export function outbidBy(comps: Comp[]) {
  const lost = comps.filter(c => !c.won && c.ourMaxBid != null && c.soldFor > 0);
  if (!lost.length) return null;
  return {
    n: lost.length,
    avg: Math.round(lost.reduce((a, c) => a + (c.soldFor - c.ourMaxBid!), 0) / lost.length),
  };
}
