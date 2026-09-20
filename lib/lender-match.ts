// Deterministic vehicle -> lender -> down payment matching. No API calls,
// no model inference — this is rules against numbers you already have
// (lender guidelines, vehicle facts, credit/income). Keep it that way:
// a lending recommendation should be auditable, not a black box, and it
// costs nothing to run. Pure functions, safe to import from client or
// server code (same pattern as schema-sketch/bid-math.ts).
//
// Two different kinds of "no":
//  - Collateral gates (title, mileage, age) are about the vehicle itself.
//    Programs don't flex on these — treat as a real exclusion.
//  - Applicant gates (credit score, PTI, down payment) are about the
//    person, and lenders routinely make exceptions here when the rest of
//    the profile is strong. Never report these as a flat denial — flag
//    them, and say how much of a stretch the exception would be.

export type TitleStatus = "clean" | "salvage" | "rebuilt" | "flood" | "lemon" | "branded";

export interface VehicleForMatch {
  askingPriceCents: number;
  bookValueCents: number | null; // falls back to askingPriceCents when unset
  miles: number | null;
  year: number | null;
  title: TitleStatus;
}

export interface ApplicantForMatch {
  creditScore: number | null;
  monthlyIncomeCents: number | null;
  availableDownCents: number;
  /** Existing car payment(s) already on the credit file — rolled into the
   * PTI check below so it reflects total auto debt, not just this deal's
   * payment in isolation. */
  openAutoPaymentCents?: number | null;
}

export interface ProgramForMatch {
  lenderId: string;
  lenderName: string;
  programId: string;
  programLabel: string;
  advancePct: number;
  maxLtvPct: number | null;
  maxTermMonths: number | null;
  maxMiles: number | null;
  maxAgeYears: number | null;
  allowedTitles: TitleStatus[] | null;
  minCreditScore: number | null;
  maxPtiPct: number | null;
  typicalAprBps: number | null;
}

export type MatchStatus = "fits" | "flagged" | "excluded";
export type ExceptionSeverity = "minor" | "moderate" | "major";
export type ExceptionLikelihood = "strong" | "possible" | "unlikely";

export interface ApplicantFlag {
  dimension: "credit" | "pti" | "down";
  reason: string;
  severity: ExceptionSeverity;
}

export interface ProgramMatchResult {
  lenderId: string;
  lenderName: string;
  programId: string;
  programLabel: string;

  status: MatchStatus;
  /** Vehicle-level gates that failed. Non-empty only when status === "excluded". */
  collateralStops: string[];
  /** Credit/income/down gates that failed. Non-empty only when status === "flagged". */
  applicantFlags: ApplicantFlag[];
  exceptionLikelihood: ExceptionLikelihood | null;
  exceptionNote: string | null;

  /** Missing-data notices — not pass/fail, just "this wasn't checkable." */
  cautions: string[];

  maxAdvanceCents: number;
  requiredDownCents: number;
  downShortfallCents: number;
  estimatedMonthlyPaymentCents: number | null;
  estimatedPtiPct: number | null;
}

/** Standard amortized monthly payment. Returns null if any input is missing. */
export function estimateMonthlyPaymentCents(
  financedCents: number,
  aprBps: number | null,
  termMonths: number | null,
): number | null {
  if (aprBps == null || termMonths == null || termMonths <= 0) return null;
  if (financedCents <= 0) return 0;
  const monthlyRate = aprBps / 10_000 / 12;
  if (monthlyRate === 0) return Math.round(financedCents / termMonths);
  const factor = Math.pow(1 + monthlyRate, termMonths);
  const payment = (financedCents * monthlyRate * factor) / (factor - 1);
  return Math.round(payment);
}

function vehicleAgeYears(year: number | null): number | null {
  if (year == null) return null;
  return new Date().getFullYear() - year;
}

function fmtCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// How far past the guideline still counts as "probably fine to ask about"
// vs. "a real stretch." These are judgment calls, not lender-confirmed
// thresholds — the UI always labels this as a distance-from-guideline
// heuristic, never a prediction of what the lender will actually do.
function creditSeverity(pointsBelow: number): ExceptionSeverity {
  if (pointsBelow <= 15) return "minor";
  if (pointsBelow <= 40) return "moderate";
  return "major";
}
function ptiSeverity(pointsOver: number): ExceptionSeverity {
  if (pointsOver <= 1.5) return "minor";
  if (pointsOver <= 4) return "moderate";
  return "major";
}
function downSeverity(shortfallRatio: number): ExceptionSeverity {
  if (shortfallRatio <= 0.1) return "minor";
  if (shortfallRatio <= 0.3) return "moderate";
  return "major";
}

function overallLikelihood(flags: ApplicantFlag[]): ExceptionLikelihood {
  if (flags.some((f) => f.severity === "major")) return "unlikely";
  if (flags.every((f) => f.severity === "minor")) return "strong";
  return "possible";
}

function exceptionNoteFor(likelihood: ExceptionLikelihood, flags: ApplicantFlag[]): string {
  const dims = flags.map((f) => f.dimension);
  const on = dims.length > 1 ? "on a few things" : `on ${dims[0]}`;
  switch (likelihood) {
    case "strong":
      return `Close to guideline ${on} — worth a call, these often get flexed when the rest of the file is clean.`;
    case "possible":
      return `A real stretch ${on}, but not a lost cause — worth asking, especially if another part of the profile is strong (extra down, longer time on the job, etc).`;
    case "unlikely":
      return `Meaningfully outside guideline ${on} — an exception is possible but a long shot. Ask if you want, but plan on another lender.`;
  }
}

export function matchProgram(
  vehicle: VehicleForMatch,
  applicant: ApplicantForMatch,
  program: ProgramForMatch,
): ProgramMatchResult {
  const collateralStops: string[] = [];
  const applicantFlags: ApplicantFlag[] = [];
  const cautions: string[] = [];

  // --- Collateral gates: not exception-eligible ---

  if (program.allowedTitles && !program.allowedTitles.includes(vehicle.title)) {
    collateralStops.push(`Title is "${vehicle.title}" — program only allows ${program.allowedTitles.join(", ")}.`);
  }

  if (program.maxMiles == null) {
    cautions.push("Program doesn't specify a mileage cap — verify.");
  } else if (vehicle.miles == null) {
    cautions.push(`Program caps mileage at ${program.maxMiles.toLocaleString()} — vehicle's mileage isn't on file, so this wasn't checked.`);
  } else if (vehicle.miles > program.maxMiles) {
    collateralStops.push(`${vehicle.miles.toLocaleString()} miles exceeds the program's ${program.maxMiles.toLocaleString()} cap.`);
  }

  const ageYears = vehicleAgeYears(vehicle.year);
  if (program.maxAgeYears == null) {
    cautions.push("Program doesn't specify an age cap — verify.");
  } else if (ageYears == null) {
    cautions.push(`Program caps age at ${program.maxAgeYears} years — vehicle's year isn't on file, so this wasn't checked.`);
  } else if (ageYears > program.maxAgeYears) {
    collateralStops.push(`Vehicle is ${ageYears} years old — program caps at ${program.maxAgeYears}.`);
  }

  // --- Applicant gates: flagged, not denied ---

  if (program.minCreditScore != null) {
    if (applicant.creditScore == null) {
      cautions.push(`Program guideline is ${program.minCreditScore}+ credit — no score on file yet.`);
    } else if (applicant.creditScore < program.minCreditScore) {
      const gap = program.minCreditScore - applicant.creditScore;
      applicantFlags.push({
        dimension: "credit",
        reason: `Credit score ${applicant.creditScore} is ${gap} points under the program's ${program.minCreditScore} guideline.`,
        severity: creditSeverity(gap),
      });
    }
  } else {
    cautions.push("Program doesn't specify a minimum credit score — verify.");
  }

  const bookValue = vehicle.bookValueCents ?? vehicle.askingPriceCents;
  const maxAdvanceCents = Math.round(bookValue * (program.advancePct / 100));
  const requiredDownCents = Math.max(0, vehicle.askingPriceCents - maxAdvanceCents);
  const downShortfallCents = Math.max(0, requiredDownCents - applicant.availableDownCents);
  if (downShortfallCents > 0) {
    applicantFlags.push({
      dimension: "down",
      reason: `Needs ${fmtCents(downShortfallCents)} more down than the customer has available.`,
      severity: downSeverity(downShortfallCents / requiredDownCents),
    });
  }

  // Never finance more than this lender would actually advance — if the
  // customer's down payment falls short, the payment shown is "if the
  // lender maxed out," not "if the full gap were magically financed."
  const financedCents = Math.max(
    0,
    Math.min(vehicle.askingPriceCents - applicant.availableDownCents, maxAdvanceCents),
  );
  const estimatedMonthlyPaymentCents = estimateMonthlyPaymentCents(
    financedCents,
    program.typicalAprBps,
    program.maxTermMonths,
  );
  if (program.typicalAprBps == null) cautions.push("No typical APR on file for this program — payment not estimated.");

  let estimatedPtiPct: number | null = null;
  if (estimatedMonthlyPaymentCents != null && applicant.monthlyIncomeCents) {
    const openAutoPaymentCents = applicant.openAutoPaymentCents ?? 0;
    const totalAutoPaymentCents = estimatedMonthlyPaymentCents + openAutoPaymentCents;
    estimatedPtiPct = Math.round((totalAutoPaymentCents / applicant.monthlyIncomeCents) * 1000) / 10;
    if (program.maxPtiPct != null && estimatedPtiPct > program.maxPtiPct) {
      const gap = Math.round((estimatedPtiPct - program.maxPtiPct) * 10) / 10;
      applicantFlags.push({
        dimension: "pti",
        reason: openAutoPaymentCents
          ? `Estimated payment plus ${fmtCents(openAutoPaymentCents)}/mo of existing auto debt is ${estimatedPtiPct}% of income — ${gap} points over the program's ${program.maxPtiPct}% PTI cap.`
          : `Estimated payment is ${estimatedPtiPct}% of income — ${gap} points over the program's ${program.maxPtiPct}% PTI cap.`,
        severity: ptiSeverity(gap),
      });
    }
  } else if (program.maxPtiPct != null) {
    cautions.push("Can't check the PTI cap yet — missing income or an APR to estimate payment.");
  }

  const status: MatchStatus =
    collateralStops.length > 0 ? "excluded" : applicantFlags.length > 0 ? "flagged" : "fits";
  const exceptionLikelihood = status === "flagged" ? overallLikelihood(applicantFlags) : null;
  const exceptionNote =
    status === "flagged" && exceptionLikelihood ? exceptionNoteFor(exceptionLikelihood, applicantFlags) : null;

  return {
    lenderId: program.lenderId,
    lenderName: program.lenderName,
    programId: program.programId,
    programLabel: program.programLabel,
    status,
    collateralStops,
    applicantFlags,
    exceptionLikelihood,
    exceptionNote,
    cautions,
    maxAdvanceCents,
    requiredDownCents,
    downShortfallCents,
    estimatedMonthlyPaymentCents,
    estimatedPtiPct,
  };
}

const STATUS_RANK: Record<MatchStatus, number> = { fits: 0, flagged: 1, excluded: 2 };
const LIKELIHOOD_RANK: Record<ExceptionLikelihood, number> = { strong: 0, possible: 1, unlikely: 2 };

/**
 * Fits first, then flagged (best exception odds first), excluded last.
 * Within a tier, a preferred lender (if named and still in that tier)
 * goes first, then lowest required down, then lowest estimated payment.
 *
 * `priorityLenderNames` is how a dealership-specific relationship (e.g.
 * "Westlake gives our best approvals for US-ID customers") gets applied —
 * it's a tie-breaker within a status tier, never something that promotes
 * a worse-fitting program over a better one, and the caller decides who's
 * on the list and when it applies. Matched case-insensitively.
 */
export function matchAllPrograms(
  vehicle: VehicleForMatch,
  applicant: ApplicantForMatch,
  programs: ProgramForMatch[],
  priorityLenderNames?: string[],
): ProgramMatchResult[] {
  const priority = new Set((priorityLenderNames ?? []).map((n) => n.toLowerCase()));
  const isPriority = (r: ProgramMatchResult) => priority.has(r.lenderName.toLowerCase());

  return programs
    .map((p) => matchProgram(vehicle, applicant, p))
    .sort((a, b) => {
      if (a.status !== b.status) return STATUS_RANK[a.status] - STATUS_RANK[b.status];
      if (a.status === "flagged" && a.exceptionLikelihood && b.exceptionLikelihood) {
        const rankDiff = LIKELIHOOD_RANK[a.exceptionLikelihood] - LIKELIHOOD_RANK[b.exceptionLikelihood];
        if (rankDiff !== 0) return rankDiff;
      }
      const aPriority = isPriority(a);
      const bPriority = isPriority(b);
      if (aPriority !== bPriority) return aPriority ? -1 : 1;
      if (a.requiredDownCents !== b.requiredDownCents) return a.requiredDownCents - b.requiredDownCents;
      const ap = a.estimatedMonthlyPaymentCents ?? Infinity;
      const bp = b.estimatedMonthlyPaymentCents ?? Infinity;
      return ap - bp;
    });
}

// --- Vehicle matching ---------------------------------------------------
//
// "Which unit in stock actually works for this applicant" is the same
// question as "which program fits this vehicle," just asked from the
// other direction — so it reuses matchAllPrograms per vehicle rather than
// a separate affordability formula. No new numbers, no new rules.

export interface VehicleCandidate {
  id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  askingPriceCents: number | null;
  bookValueCents: number | null;
  miles: number | null;
  title: TitleStatus;
  bodyType: string | null;
}

export interface VehicleMatchResult {
  vehicle: VehicleCandidate;
  /** matchAllPrograms(), already sorted best-first for this vehicle. Empty if there's no price to match against. */
  programResults: ProgramMatchResult[];
  bestStatus: MatchStatus | null;
  fitsCount: number;
}

/**
 * Ranks in-stock vehicles by how well the applicant's profile fits them
 * across the lender programs on file. `wantBodyType`, when set, filters
 * the pool first — but a null/unset want still ranks the whole lot, since
 * "no stated preference" shouldn't mean "no suggestions."
 */
export function matchVehiclesForApplicant(
  vehicles: VehicleCandidate[],
  applicant: ApplicantForMatch,
  programs: ProgramForMatch[],
  wantBodyType?: string | null,
  priorityLenderNames?: string[],
): VehicleMatchResult[] {
  const pool = wantBodyType ? vehicles.filter((v) => v.bodyType === wantBodyType) : vehicles;

  return pool
    .map((vehicle): VehicleMatchResult => {
      if (vehicle.askingPriceCents == null) {
        return { vehicle, programResults: [], bestStatus: null, fitsCount: 0 };
      }
      const programResults = matchAllPrograms(
        { askingPriceCents: vehicle.askingPriceCents, bookValueCents: vehicle.bookValueCents, miles: vehicle.miles, year: vehicle.year, title: vehicle.title },
        applicant,
        programs,
        priorityLenderNames,
      );
      return {
        vehicle,
        programResults,
        bestStatus: programResults[0]?.status ?? null,
        fitsCount: programResults.filter((r) => r.status === "fits").length,
      };
    })
    .sort((a, b) => {
      const rank = (r: VehicleMatchResult) => (r.bestStatus ? STATUS_RANK[r.bestStatus] : 3);
      const rankDiff = rank(a) - rank(b);
      if (rankDiff !== 0) return rankDiff;
      if (a.fitsCount !== b.fitsCount) return b.fitsCount - a.fitsCount;
      const ap = a.vehicle.askingPriceCents ?? Infinity;
      const bp = b.vehicle.askingPriceCents ?? Infinity;
      return ap - bp;
    });
}
