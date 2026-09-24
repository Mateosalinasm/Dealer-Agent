// Louisiana out-of-state tax/fee estimate for a unit titled through
// Automotive Titling Company (ATC). The formula and every default fee
// below are transcribed directly from two real ATC quotes (Lafayette
// Parish and Jefferson Parish, both September 2026) — nothing here is
// guessed. Never reimplement this math elsewhere; import it.
//
// Confirmed against both reference quotes to the cent:
//   Lafayette:  5.00% state + 4.00% parish on $37,249.00 taxable ->
//               $1,862.45 + $1,489.96 = $3,352.41 tax, $3,822.91 total.
//   Jefferson:  5.00% state + 4.75% parish on $27,344.00 taxable ->
//               $1,367.20 + $1,298.84 = $2,666.04 tax, $3,136.54 total.

export interface LouisianaOutOfStateInput {
  basePriceCents: number;
  deliveryFeesCents: number;
  dealerServiceFeeCents: number;
  theftProtectionCents: number;
  additionsCents: number;
  protectionPackagesCents: number;
  manufacturerRebateCents: number;
  tradeInAmountCents: number;
  stateRatePct: number; // ATC quotes both show 5.0000% flat, statewide
  parishRatePct: number; // varies by parish — see LOUISIANA_PARISH_PRESETS
  localHandlingFeeCents: number;
  registrationFeeCents: number; // GVWR-based per ATC; the default is the passenger-vehicle bracket seen on both references
  titleFeesCents: number; // title fee + lien fee combined, as ATC lines it
  atcServiceFeeCents: number;
  mailingExpenseCents: number;
}

export interface LouisianaOutOfStateResult {
  taxableValueCents: number;
  stateTaxCents: number;
  parishTaxCents: number;
  taxSubtotalCents: number;
  totalFeesCents: number;
  totalDueCents: number;
}

// Two parishes confirmed from real quotes. Anything else needs the actual
// rate looked up (ATC's site or the parish) rather than guessed — never add
// a parish here without a real reference the way these two were built.
export const LOUISIANA_PARISH_PRESETS = [
  { name: "Lafayette Parish", ratePct: 4.0 },
  { name: "Jefferson Parish", ratePct: 4.75 },
] as const;

export const LOUISIANA_DEFAULTS = {
  stateRatePct: 5.0,
  localHandlingFeeCents: 10_000,
  registrationFeeCents: 11_200,
  titleFeesCents: 9_150,
  atcServiceFeeCents: 9_900,
  mailingExpenseCents: 6_800,
} as const;

function round(cents: number): number {
  return Math.round(cents);
}

export function calculateLouisianaOutOfState(input: LouisianaOutOfStateInput): LouisianaOutOfStateResult {
  const taxableValueCents =
    input.basePriceCents +
    input.deliveryFeesCents +
    input.dealerServiceFeeCents +
    input.theftProtectionCents +
    input.additionsCents +
    input.protectionPackagesCents -
    input.manufacturerRebateCents -
    input.tradeInAmountCents;

  const stateTaxCents = round((input.stateRatePct / 100) * taxableValueCents);
  const parishTaxCents = round((input.parishRatePct / 100) * taxableValueCents);
  const taxSubtotalCents = stateTaxCents + parishTaxCents;

  const totalFeesCents =
    input.localHandlingFeeCents + input.registrationFeeCents + input.titleFeesCents + input.atcServiceFeeCents + input.mailingExpenseCents;

  return {
    taxableValueCents,
    stateTaxCents,
    parishTaxCents,
    taxSubtotalCents,
    totalFeesCents,
    totalDueCents: taxSubtotalCents + totalFeesCents,
  };
}
