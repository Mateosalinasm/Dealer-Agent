import type { CreditFacts } from "@/lib/credit-grade";
import type { EXTRACTION_SCHEMAS } from "@/lib/extraction-schemas";

export type CreditReportExtracted = (typeof EXTRACTION_SCHEMAS)["credit_report"]["_output"];

/**
 * What a successful credit-report extraction should write onto the deal's
 * credit facts — only ever into a field that's currently blank, same
 * never-overwrite rule as creditAppFillPatch. Two of the eight CreditFacts
 * fields don't have an exact match in what a bureau report reports:
 * inquiries30d is filled from the report's 6-month inquiry count (the
 * report doesn't break out a 30-day figure), and autoLates is filled from
 * the report's general 30+ day late payment count (not auto-specific) —
 * both are the closest real number on the document, not an exact match,
 * same "best-faith translation" spirit as the grading bands themselves
 * (see lib/credit-grade.ts).
 */
export function creditReportFillPatch(current: CreditFacts, extracted: CreditReportExtracted): Partial<CreditFacts> {
  const patch: Partial<CreditFacts> = {};

  const firstScore = extracted.scores.find((s) => s.score != null)?.score ?? null;
  if (current.fico == null && firstScore != null) patch.fico = firstScore;
  if (current.inquiries30d == null && extracted.inquiriesLast6Months != null) patch.inquiries30d = extracted.inquiriesLast6Months;
  if (current.repossessions == null && extracted.derogatory.repossessions != null) patch.repossessions = extracted.derogatory.repossessions;
  if (current.collectionsAmount == null && extracted.collectionsBalanceCents != null) patch.collectionsAmount = extracted.collectionsBalanceCents;
  if (current.openAutos == null && extracted.openAutoLoans != null) patch.openAutos = extracted.openAutoLoans;
  if (current.autoLates == null && extracted.derogatory.latePayments30Plus != null) patch.autoLates = extracted.derogatory.latePayments30Plus;
  if (current.bankruptcies == null && extracted.derogatory.bankruptcies != null) patch.bankruptcies = extracted.derogatory.bankruptcies;
  if (current.mortgages == null && extracted.openMortgages != null) patch.mortgages = extracted.openMortgages;

  return patch;
}
