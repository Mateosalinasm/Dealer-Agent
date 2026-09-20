import { z } from "zod";

// Structured shapes for what gets pulled out of each document category.
// Every field is nullable — the extraction prompt (lib/extraction.ts) is
// instructed to use null rather than guess, per the "never fabricate"
// rule. Money is integer cents throughout, same as the rest of the app.
//
// Deliberately NOT extracted anywhere here: full SSNs, full account/card
// numbers, full DOB. Only last-4 where a number needs to be referenced.

const confidence = z.enum(["known", "inferred", "unknown"]).nullable();

export const turbopassSchema = z.object({
  applicantName: z.string().nullable(),
  reportDate: z.string().nullable().describe("ISO date if present"),
  accounts: z.array(
    z.object({
      institution: z.string().nullable(),
      accountType: z.string().nullable().describe("checking, savings, etc."),
      last4: z.string().nullable(),
      currentBalanceCents: z.number().int().nullable(),
    }),
  ),
  incomeSources: z.array(
    z.object({
      payer: z.string().nullable().describe("employer or source name"),
      description: z.string().nullable(),
      monthlyAverageCents: z.number().int().nullable(),
      frequency: z.string().nullable().describe("weekly, biweekly, monthly, irregular"),
      confidence,
    }),
  ),
  totalMonthlyIncomeCents: z.number().int().nullable(),
  notes: z.string().nullable().describe("anything ambiguous or worth a human double-checking"),
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
  recurringDeposits: z.array(
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
  scores: z.array(z.object({ bureau: z.string().nullable(), score: z.number().int().nullable() })),
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

export const creditAppSchema = z.object({
  applicantName: z.string().nullable(),
  coApplicantName: z.string().nullable(),
  address: z.string().nullable(),
  employer: z.string().nullable(),
  jobTitle: z.string().nullable(),
  monthlyIncomeStatedCents: z.number().int().nullable(),
  yearsAtJob: z.number().nullable(),
  monthlyHousingPaymentCents: z.number().int().nullable(),
  residenceType: z.string().nullable().describe("own, rent, live with family, etc."),
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
  odometerReadings: z.array(
    z.object({
      date: z.string().nullable().describe("ISO date if present"),
      miles: z.number().int().nullable(),
      source: z.string().nullable().describe("title, registration, service record, etc."),
    }),
  ),
  odometerConsistent: z.boolean().nullable().describe("false if any reading rolls backward against an earlier one"),
  notes: z.string().nullable(),
});

export const EXTRACTION_SCHEMAS = {
  turbopass: turbopassSchema,
  bank_statement: bankStatementSchema,
  credit_report: creditReportSchema,
  credit_app: creditAppSchema,
  autocheck: autocheckSchema,
} as const;

export type ExtractableCategory = keyof typeof EXTRACTION_SCHEMAS;

export function isExtractable(category: string): category is ExtractableCategory {
  return category in EXTRACTION_SCHEMAS;
}

export type ExtractedData<C extends ExtractableCategory> = z.infer<(typeof EXTRACTION_SCHEMAS)[C]>;
