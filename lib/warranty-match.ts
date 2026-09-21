// Deterministic vehicle -> F&I product matching, same house style as
// lib/lender-match.ts: rules against numbers already on file, no AI, no
// black box. A "recommended" flag is always accompanied by the plain-
// English reason so it can be checked against judgment, not trusted
// blind.

export type WarrantyProductType = "vsc" | "gap" | "tire_wheel" | "key_replacement" | "maintenance" | "other";

export interface VehicleForWarrantyMatch {
  year: number | null;
  miles: number | null;
}

export interface DealForWarrantyMatch {
  salePriceCents: number | null;
  cashDownCents: number | null;
  /** Trade payoff exceeding trade ACV is negative equity rolled into the new note — raises GAP exposure. */
  tradePayoffCents: number | null;
  tradeAcvCents: number | null;
}

export interface WarrantyProductForMatch {
  id: string;
  name: string;
  provider: string;
  productType: WarrantyProductType;
  costCents: number;
  priceCents: number;
  termMonths: number | null;
  termMiles: number | null;
  deductibleCents: number | null;
  maxVehicleAgeYears: number | null;
  maxVehicleMiles: number | null;
  minSalePriceCents: number | null;
  maxSalePriceCents: number | null;
  active: boolean;
}

export interface WarrantyMatchResult {
  id: string;
  name: string;
  provider: string;
  productType: WarrantyProductType;
  eligible: boolean;
  exclusionReasons: string[];
  cautions: string[];
  recommended: boolean;
  recommendReason: string | null;
  costCents: number;
  priceCents: number;
  marginCents: number;
}

function vehicleAgeYears(year: number | null): number | null {
  if (year == null) return null;
  return new Date().getFullYear() - year;
}

// Rough, commonly-used cutoff for when a factory bumper-to-bumper
// warranty has typically lapsed — this is a heuristic for *when VSC
// coverage starts mattering*, not a claim about any specific manufacturer's
// actual terms. Always shown with its reasoning, never presented as fact.
const TYPICAL_FACTORY_WARRANTY_AGE_YEARS = 3;
const TYPICAL_FACTORY_WARRANTY_MILES = 36_000;

/**
 * Ranks the active product catalog for one deal's vehicle/structure.
 * `recommended` is a soft signal (GAP when equity is thin, VSC when the
 * factory warranty has likely lapsed) — never a hard gate. `eligible`
 * (age/mileage/price caps) is the only pass/fail.
 */
export function matchWarrantyProducts(
  vehicle: VehicleForWarrantyMatch,
  deal: DealForWarrantyMatch,
  products: WarrantyProductForMatch[],
): WarrantyMatchResult[] {
  const ageYears = vehicleAgeYears(vehicle.year);

  const results = products
    .filter((p) => p.active)
    .map((p): WarrantyMatchResult => {
      const exclusionReasons: string[] = [];
      const cautions: string[] = [];

      if (p.maxVehicleAgeYears != null) {
        if (ageYears == null) cautions.push(`Caps eligibility at ${p.maxVehicleAgeYears} years old — vehicle's year isn't on file, so this wasn't checked.`);
        else if (ageYears > p.maxVehicleAgeYears) exclusionReasons.push(`Vehicle is ${ageYears} years old — product caps at ${p.maxVehicleAgeYears}.`);
      }
      if (p.maxVehicleMiles != null) {
        if (vehicle.miles == null) cautions.push(`Caps eligibility at ${p.maxVehicleMiles.toLocaleString()} miles — vehicle's mileage isn't on file, so this wasn't checked.`);
        else if (vehicle.miles > p.maxVehicleMiles) exclusionReasons.push(`${vehicle.miles.toLocaleString()} miles exceeds the product's ${p.maxVehicleMiles.toLocaleString()} cap.`);
      }
      if (p.minSalePriceCents != null || p.maxSalePriceCents != null) {
        if (deal.salePriceCents == null) {
          cautions.push("Product has a sale-price eligibility range — no sale price on file yet, so this wasn't checked.");
        } else {
          if (p.minSalePriceCents != null && deal.salePriceCents < p.minSalePriceCents) {
            exclusionReasons.push(`Sale price is below the product's ${(p.minSalePriceCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} minimum.`);
          }
          if (p.maxSalePriceCents != null && deal.salePriceCents > p.maxSalePriceCents) {
            exclusionReasons.push(`Sale price is above the product's ${(p.maxSalePriceCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} maximum.`);
          }
        }
      }

      let recommended = false;
      let recommendReason: string | null = null;

      if (p.productType === "gap") {
        const negativeEquityCents = Math.max(0, (deal.tradePayoffCents ?? 0) - (deal.tradeAcvCents ?? 0));
        const downRatio = deal.salePriceCents ? (deal.cashDownCents ?? 0) / deal.salePriceCents : null;
        if (negativeEquityCents > 0) {
          recommended = true;
          recommendReason = `Trade payoff exceeds trade value by ${(negativeEquityCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} — that negative equity is rolling into the new note.`;
        } else if (downRatio != null && downRatio < 0.1) {
          recommended = true;
          recommendReason = "Down payment is under 10% of the sale price — thin equity in the first year raises GAP exposure.";
        }
      } else if (p.productType === "vsc") {
        const ageOverCutoff = ageYears != null && ageYears >= TYPICAL_FACTORY_WARRANTY_AGE_YEARS;
        const milesOverCutoff = vehicle.miles != null && vehicle.miles >= TYPICAL_FACTORY_WARRANTY_MILES;
        if (ageOverCutoff || milesOverCutoff) {
          recommended = true;
          recommendReason = ageOverCutoff && milesOverCutoff
            ? `Vehicle is ${ageYears} years old with ${vehicle.miles!.toLocaleString()} miles — a typical factory bumper-to-bumper warranty has likely lapsed on both counts.`
            : ageOverCutoff
              ? `Vehicle is ${ageYears} years old — a typical factory bumper-to-bumper warranty (${TYPICAL_FACTORY_WARRANTY_AGE_YEARS} yr) has likely lapsed.`
              : `Vehicle has ${vehicle.miles!.toLocaleString()} miles — a typical factory bumper-to-bumper warranty (${TYPICAL_FACTORY_WARRANTY_MILES.toLocaleString()} mi) has likely lapsed.`;
        }
      }

      return {
        id: p.id,
        name: p.name,
        provider: p.provider,
        productType: p.productType,
        eligible: exclusionReasons.length === 0,
        exclusionReasons,
        cautions,
        recommended,
        recommendReason,
        costCents: p.costCents,
        priceCents: p.priceCents,
        marginCents: p.priceCents - p.costCents,
      };
    });

  return results.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
    return b.marginCents - a.marginCents;
  });
}
