import { z } from "zod";

// Structured shapes for what gets pulled out of each document category.
// Every field is nullable — the extraction prompt (lib/extraction.ts) is
// instructed to use null rather than guess, per the "never fabricate"
// rule. Money is integer cents throughout, same as the rest of the app.
//
// Deliberately NOT extracted anywhere here: full SSNs, full account/card
// numbers. Only last-4 where a number needs to be referenced. DOB *is*
// extracted (creditAppSchema.dob) — unlike SSN, the finance manager
// explicitly asked for it to auto-fill from an uploaded credit app.

// Tool-use output isn't schema-enforced at the API level the way a plain
// JSON mode is — the model occasionally writes a string ("none found") or
// null into a list field instead of an empty array when it finds nothing.
// Coerce anything that isn't already an array to [] rather than failing
// the whole extraction over one malformed sub-field; a human reviews
// every extraction anyway (see the "Couldn't read" badge in the UI), so
// silently treating "not an array" as "nothing found" is a safe degrade.
const looseArray = <T extends z.ZodTypeAny>(item: T) => z.preprocess((val) => (Array.isArray(val) ? val : []), z.array(item));

// Same tool-call looseness, different shape: an optional nested section
// (e.g. "previous address" when the form doesn't have one) sometimes comes
// back as a placeholder string ("N/A", "none", "") instead of null, which
// fails a plain .nullable() object parse and takes the whole extraction
// down with it over one blank section. Anything that isn't a real object
// becomes null.
const looseNullableObject = <T extends z.ZodRawShape>(shape: T) => z.preprocess((val) => (val && typeof val === "object" && !Array.isArray(val) ? val : null), z.object(shape).nullable());

// Same idea for a nullable number: the model occasionally writes "" or a
// non-numeric placeholder instead of null for a figure that isn't on the
// document (e.g. no "other income" line at all). A numeric-looking string
// still converts through; anything else becomes null rather than failing.
const looseNullableNumber = () =>
  z.preprocess((val) => {
    if (typeof val === "number") return val;
    if (typeof val === "string" && val.trim() !== "" && !Number.isNaN(Number(val))) return Number(val);
    return null;
  }, z.number().int().nullable());

// The categories a TurboPass transaction can fall into — grouping and the
// income baseline math (lib/turbopass-analysis.ts) both key off this list,
// so it doubles as the taxonomy for the "Accounts" category breakdown.
export const turbopassTransactionCategoryValues = [
  "payroll",
  "zelle",
  "internal_transfer",
  "mobile_deposit",
  "cash_deposit",
  "fee",
  "card_debit",
  "other",
] as const;

// A single malformed leaf field (a stray string where a number was
// expected, an off-taxonomy category) would otherwise fail validation for
// its whole containing array — brutal when that array can run to hundreds
// of transaction rows. .catch(null) makes every leaf field independently
// fault-tolerant: one bad field degrades to null instead of discarding
// the entire report. `category` deliberately stays a plain string rather
// than a strict enum for the same reason — normalized against
// turbopassTransactionCategoryValues in lib/turbopass-analysis.ts instead
// of rejected here.
const leafString = z.string().nullable().catch(null);
const leafInt = z.number().int().nullable().catch(null);

export const turbopassSchema = z.object({
  applicantName: leafString,
  reportDate: leafString.describe("ISO date if present"),
  reportPeriodStart: leafString.describe("ISO date if present"),
  reportPeriodEnd: leafString.describe("ISO date if present"),
  holders: looseArray(z.object({ name: leafString })).describe(
    "Every distinct person named as an owner/holder across every account on this report — list each once even if they appear on multiple accounts",
  ),
  accounts: looseArray(
    z.object({
      last4: leafString,
      institution: leafString,
      accountType: leafString.describe("checking, savings, etc."),
      holderNames: looseArray(leafString).describe("Name(s) on this specific account"),
      monthlyDepositsCents: leafInt.describe("Total monthly deposit volume this report shows for this account"),
      avgDailyBalanceCents: leafInt,
      nsfCount: leafInt.describe("Overdraft/NSF fee count for this account"),
    }),
  ),
  transactions: looseArray(
    z.object({
      date: leafString.describe("ISO date if present"),
      description: leafString,
      counterpartyName: leafString.describe("The other party's name for a Zelle/transfer/payroll line, if the report shows one"),
      category: leafString.describe(`One of: ${turbopassTransactionCategoryValues.join(", ")}`),
      accountLast4: leafString.describe("Which account (by last4) this transaction posted to"),
      amountCents: leafInt.describe("Positive for money in, negative for money out"),
    }),
  ),
  totalMonthlyIncomeCents: leafInt.describe("Your own best estimate — the app independently recomputes the verified figure from the transaction list, this is a cross-check"),
  notes: leafString.describe("anything ambiguous or worth a human double-checking"),
});

export const bankStatementSchema = z.object({
  accountHolderName: z.string().nullable(),
  institution: z.string().nullable(),
  accountLast4: z.string().nullable(),
  statementPeriodStart: z.string().nullable(),
  statementPeriodEnd: z.string().nullable(),
  beginningBalanceCents: z.number().int().nullable(),
  endingBalanceCents: z.number().int().nullable(),
  averageDailyBalanceCents: z.number().int().nullable(),
  recurringDeposits: looseArray(
    z.object({
      description: z.string().nullable(),
      amountCents: z.number().int().nullable(),
      frequency: z.string().nullable(),
    }),
  ),
  overdraftCount: z.number().int().nullable(),
  notes: z.string().nullable(),
});

export const creditReportSchema = z.object({
  applicantName: z.string().nullable(),
  bureau: z.string().nullable().describe("Equifax, Experian, TransUnion, or unknown"),
  scores: looseArray(z.object({ bureau: z.string().nullable(), score: z.number().int().nullable() })),
  openTradelines: z.number().int().nullable(),
  openAutoLoans: z.number().int().nullable(),
  totalMonthlyDebtPaymentsCents: z.number().int().nullable(),
  derogatory: z.object({
    bankruptcies: z.number().int().nullable(),
    collections: z.number().int().nullable(),
    repossessions: z.number().int().nullable(),
    latePayments30Plus: z.number().int().nullable(),
  }),
  inquiriesLast6Months: z.number().int().nullable(),
  reportDate: z.string().nullable(),
  notes: z.string().nullable(),
});

// Shared by currentAddress/previousAddress below — mirrors
// schema-sketch/schema.ts's AddressDetail, minus rentMortCents/years/
// months naming quirks (kept aligned so applyCreditAppExtraction in
// app/desk/deals/actions.ts can copy this straight across).
const addressExtractionShape = {
  street: z.string().nullable(),
  aptUnit: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip: z.string().nullable(),
  county: z.string().nullable(),
  addressType: z.string().nullable().describe("rent, own, live with family, etc., as marked on the form"),
  rentMortCents: looseNullableNumber(),
  years: looseNullableNumber(),
  months: looseNullableNumber(),
};

// Shared by currentEmployment/previousEmployment below. Monthly income
// itself is NOT in here — it's the top-level monthlyIncomeStatedCents
// field, same one deal-underwriting.ts already reads for the income-
// source fallback. grossSalaryCents is a separate self-reported figure
// off the application (often an annual gross salary line), never used in
// any money math — display/reference only.
const employmentExtractionShape = {
  employerName: z.string().nullable(),
  occupation: z.string().nullable(),
  employerPhone: z.string().nullable(),
  employmentStatus: z.string().nullable().describe("employed full time, part time, self-employed, retired, etc."),
  incomeType: z.string().nullable().describe("how income is verified/paid, e.g. TurboPass, pay stub, self-employed, as labeled on the form"),
  grossSalaryCents: looseNullableNumber(),
  yearsAtJob: looseNullableNumber(),
  monthsAtJob: looseNullableNumber(),
  street: z.string().nullable(),
  aptUnit: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip: z.string().nullable(),
  county: z.string().nullable(),
};

export const creditAppSchema = z.object({
  applicantName: z.string().nullable(),
  coApplicantName: z.string().nullable(),
  gender: z.string().nullable(),
  dob: z.string().nullable().describe("ISO date if present"),
  // Last 4 only — same rule as every other document type here. A full
  // SSN never goes through the extraction pipeline; the finance manager
  // types the full number by hand into the deal's own ssn field.
  ssnLast4: z.string().nullable(),
  cellPhone: z.string().nullable(),
  homePhone: z.string().nullable(),
  workPhone: z.string().nullable(),
  email: z.string().nullable(),
  idType: z.string().nullable(),
  idState: z.string().nullable(),
  idNumber: z.string().nullable(),
  idIssuedDate: z.string().nullable().describe("ISO date if present"),
  idExpirationDate: z.string().nullable().describe("ISO date if present"),
  currentAddress: looseNullableObject(addressExtractionShape),
  previousAddress: looseNullableObject(addressExtractionShape),
  currentEmployment: looseNullableObject(employmentExtractionShape),
  previousEmployment: looseNullableObject(employmentExtractionShape),
  monthlyIncomeStatedCents: looseNullableNumber(),
  otherIncomeAmountCents: looseNullableNumber(),
  otherIncomeSource: z.string().nullable(),
  notes: z.string().nullable(),
});

export const autocheckSchema = z.object({
  vin: z.string().nullable(),
  year: z.number().int().nullable(),
  make: z.string().nullable(),
  model: z.string().nullable(),
  trim: z.string().nullable(),
  currentMileage: z.number().int().nullable(),
  titleBrand: z.string().nullable().describe("clean, salvage, rebuilt, flood, lemon, or branded, as reported"),
  ownerCount: z.number().int().nullable(),
  accidentsReported: z.number().int().nullable(),
  odometerReadings: looseArray(
    z.object({
      date: z.string().nullable().describe("ISO date if present"),
      miles: z.number().int().nullable(),
      source: z.string().nullable().describe("title, registration, service record, etc."),
    }),
  ),
  odometerConsistent: z.boolean().nullable().describe("false if any reading rolls backward against an earlier one"),
  notes: z.string().nullable(),
});

export const insuranceSchema = z.object({
  insuredName: z.string().nullable(),
  policyNumber: z.string().nullable(),
  effectiveDate: z.string().nullable().describe("ISO date if present"),
  expirationDate: z.string().nullable().describe("ISO date if present"),
  drivers: looseArray(z.object({ name: z.string().nullable() })),
  vehicles: looseArray(
    z.object({
      vin: z.string().nullable(),
      year: z.number().int().nullable(),
      make: z.string().nullable(),
      model: z.string().nullable(),
      comprehensiveDeductibleCents: z.number().int().nullable(),
      collisionDeductibleCents: z.number().int().nullable(),
    }),
  ),
  lienholder: z.object({
    name: z.string().nullable(),
    address: z.string().nullable(),
  }),
  notes: z.string().nullable(),
});

export const EXTRACTION_SCHEMAS = {
  turbopass: turbopassSchema,
  bank_statement: bankStatementSchema,
  credit_report: creditReportSchema,
  credit_app: creditAppSchema,
  autocheck: autocheckSchema,
  insurance: insuranceSchema,
} as const;

export type ExtractableCategory = keyof typeof EXTRACTION_SCHEMAS;

export function isExtractable(category: string): category is ExtractableCategory {
  return category in EXTRACTION_SCHEMAS;
}

export type ExtractedData<C extends ExtractableCategory> = z.infer<(typeof EXTRACTION_SCHEMAS)[C]>;
