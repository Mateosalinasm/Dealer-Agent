import type { EXTRACTION_SCHEMAS } from "@/lib/extraction-schemas";

export type InsuranceExtracted = (typeof EXTRACTION_SCHEMAS)["insurance"]["_output"];

export interface InsuranceIssue {
  code: string;
  message: string;
}

export type InsuranceStatus = "unverified" | "verified" | "issues";

export interface InsuranceVerificationResult {
  status: InsuranceStatus;
  issues: InsuranceIssue[];
}

export interface MatchedLender {
  name: string;
  address: string | null;
  maxDeductibleCents: number;
}

function normalize(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/[.,#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Loose "is this the same person/company" check — every word of the
 * shorter name has to appear somewhere in the longer one, so "Deon
 * Williams" matches "Williams, Deon" or "Deon M Williams" but not
 * "Deon Smith". */
function namesRoughlyMatch(a: string | null, b: string | null): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const wordsA = na.split(" ");
  const wordsB = nb.split(" ");
  const [shorter, longer] = wordsA.length <= wordsB.length ? [wordsA, wordsB] : [wordsB, wordsA];
  return shorter.length > 0 && shorter.every((w) => longer.includes(w));
}

function addressesRoughlyMatch(a: string | null, b: string | null): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function vinsMatch(a: string | null, b: string | null): boolean {
  const na = (a ?? "").toUpperCase().trim();
  const nb = (b ?? "").toUpperCase().trim();
  return !!na && !!nb && na === nb;
}

/** Finds the lenders-table row (if any) whose name roughly matches the
 * lienholder name entered on the deal — same fuzzy match verifyInsurance
 * uses internally, exported so callers can look up the row once and reuse
 * it (e.g. to show its address/deductible in the UI) instead of just
 * getting a pass/fail. */
export function findMatchingLender<T extends { name: string }>(lienholderName: string | null, lenders: T[]): T | null {
  if (!lienholderName) return null;
  return lenders.find((l) => namesRoughlyMatch(l.name, lienholderName)) ?? null;
}

/**
 * Deterministic checklist against an uploaded declaration page — never lets
 * the AI itself decide pass/fail, only transcribe what the page says (see
 * lib/extraction.ts's insurance prompt). Every rule here is a business rule
 * from the finance manager, not inferred:
 *   - the lienholder on the page has to match the lienholder entered on the
 *     deal, and that lienholder's address (from the matching lenders row,
 *     looked up by name) has to match too
 *   - comprehensive and collision deductibles each have to be at or under
 *     that lender's max-deductible figure (lenders.maxDeductibleCents —
 *     defaults to $1,000, higher for whichever lenders the finance manager
 *     has raised it for, e.g. Veros at $1,500)
 *   - the deal's primary customer has to be listed as a driver
 *   - the vehicle being financed has to be on the policy, by VIN
 */
export function verifyInsurance(params: {
  extracted: InsuranceExtracted;
  customerName: string | null;
  lienholderNameOnFile: string | null;
  vehicleVin: string | null;
  matchedLender: MatchedLender | null;
}): InsuranceVerificationResult {
  const { extracted, customerName, lienholderNameOnFile, vehicleVin, matchedLender } = params;
  const issues: InsuranceIssue[] = [];

  // --- Lienholder ---
  if (!lienholderNameOnFile) {
    issues.push({ code: "lienholder_not_on_file", message: "Enter the lienholder on this deal so it can be checked against the declaration page." });
  } else if (!extracted.lienholder.name) {
    issues.push({ code: "lienholder_missing", message: "No lienholder is listed on the declaration page." });
  } else if (!namesRoughlyMatch(extracted.lienholder.name, lienholderNameOnFile)) {
    issues.push({
      code: "lienholder_mismatch",
      message: `Lienholder on the declaration ("${extracted.lienholder.name}") doesn't match what's on file ("${lienholderNameOnFile}").`,
    });
  } else if (!matchedLender) {
    issues.push({ code: "lender_not_found", message: `No lender named "${lienholderNameOnFile}" found in Lenders — can't verify its address or deductible limit.` });
  } else {
    if (!matchedLender.address) {
      issues.push({ code: "lender_address_not_on_file", message: `${matchedLender.name} doesn't have an address on file to check against.` });
    } else if (!extracted.lienholder.address) {
      issues.push({ code: "lienholder_address_missing", message: "No lienholder address is listed on the declaration page." });
    } else if (!addressesRoughlyMatch(extracted.lienholder.address, matchedLender.address)) {
      issues.push({
        code: "address_mismatch",
        message: `Lienholder address on the declaration ("${extracted.lienholder.address}") doesn't match ${matchedLender.name}'s address on file ("${matchedLender.address}").`,
      });
    }
  }

  // --- Deductibles (checked against the vehicle being financed, if it's on the policy) ---
  const maxDeductibleCents = matchedLender?.maxDeductibleCents ?? null;
  const coveredVehicle = vehicleVin ? extracted.vehicles.find((v) => vinsMatch(v.vin, vehicleVin)) : (extracted.vehicles[0] ?? null);
  if (maxDeductibleCents != null && coveredVehicle) {
    if (coveredVehicle.comprehensiveDeductibleCents != null && coveredVehicle.comprehensiveDeductibleCents > maxDeductibleCents) {
      issues.push({
        code: "deductible_high_comprehensive",
        message: `Comprehensive deductible ($${(coveredVehicle.comprehensiveDeductibleCents / 100).toFixed(2)}) is above ${matchedLender!.name}'s $${(maxDeductibleCents / 100).toFixed(2)} limit.`,
      });
    }
    if (coveredVehicle.collisionDeductibleCents != null && coveredVehicle.collisionDeductibleCents > maxDeductibleCents) {
      issues.push({
        code: "deductible_high_collision",
        message: `Collision deductible ($${(coveredVehicle.collisionDeductibleCents / 100).toFixed(2)}) is above ${matchedLender!.name}'s $${(maxDeductibleCents / 100).toFixed(2)} limit.`,
      });
    }
  }

  // --- Primary driver ---
  if (!customerName) {
    // Nothing to check against — not the declaration's fault, don't flag it.
  } else if (!extracted.drivers.some((d) => namesRoughlyMatch(d.name, customerName))) {
    issues.push({ code: "driver_missing", message: `${customerName} isn't listed as a driver on the policy.` });
  }

  // --- Vehicle / VIN ---
  if (vehicleVin && !extracted.vehicles.some((v) => vinsMatch(v.vin, vehicleVin))) {
    issues.push({ code: "vin_missing", message: "The vehicle being financed isn't listed on the policy — VIN doesn't match." });
  }

  return { status: issues.length > 0 ? "issues" : "verified", issues };
}
