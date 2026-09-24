import type { AddressDetail, EmploymentDetail, OtherIncomeDetail } from "@/schema-sketch/schema";
import type { EXTRACTION_SCHEMAS } from "@/lib/extraction-schemas";

export type CreditAppExtracted = (typeof EXTRACTION_SCHEMAS)["credit_app"]["_output"];

export interface DealCreditAppFields {
  customerName: string | null;
  gender: string | null;
  homePhone: string | null;
  workPhone: string | null;
  email: string | null;
  idType: string | null;
  idState: string | null;
  idNumber: string | null;
  idIssuedDate: string | null;
  idExpirationDate: string | null;
  currentAddress: AddressDetail | null;
  previousAddress: AddressDetail | null;
  currentEmployment: EmploymentDetail | null;
  previousEmployment: EmploymentDetail | null;
  statedIncome: number | null;
  otherIncome: OtherIncomeDetail | null;
}

/**
 * What a successful credit-app extraction should write onto the deal —
 * only ever into a field that's currently blank. Never overwrites
 * something the finance manager already typed, whether that happened
 * before or after this credit app was uploaded, and never touches
 * deals.ssn or deals.dob: the extraction only ever surfaces ssnLast4 (see
 * lib/extraction-schemas.ts), and the full SSN/DOB stay manual-entry only.
 */
export function creditAppFillPatch(current: DealCreditAppFields, extracted: CreditAppExtracted): Partial<DealCreditAppFields> {
  const patch: Partial<DealCreditAppFields> = {};

  if (!current.customerName && extracted.applicantName) patch.customerName = extracted.applicantName;
  if (!current.gender && extracted.gender) patch.gender = extracted.gender;
  if (!current.homePhone && extracted.homePhone) patch.homePhone = extracted.homePhone;
  if (!current.workPhone && extracted.workPhone) patch.workPhone = extracted.workPhone;
  if (!current.email && extracted.email) patch.email = extracted.email;
  if (!current.idType && extracted.idType) patch.idType = extracted.idType;
  if (!current.idState && extracted.idState) patch.idState = extracted.idState;
  if (!current.idNumber && extracted.idNumber) patch.idNumber = extracted.idNumber;
  if (!current.idIssuedDate && extracted.idIssuedDate) patch.idIssuedDate = extracted.idIssuedDate;
  if (!current.idExpirationDate && extracted.idExpirationDate) patch.idExpirationDate = extracted.idExpirationDate;
  if (!current.currentAddress && extracted.currentAddress) patch.currentAddress = extracted.currentAddress;
  if (!current.previousAddress && extracted.previousAddress) patch.previousAddress = extracted.previousAddress;
  if (!current.currentEmployment && extracted.currentEmployment) patch.currentEmployment = extracted.currentEmployment;
  if (!current.previousEmployment && extracted.previousEmployment) patch.previousEmployment = extracted.previousEmployment;
  if (current.statedIncome == null && extracted.monthlyIncomeStatedCents != null) patch.statedIncome = extracted.monthlyIncomeStatedCents;
  if (!current.otherIncome && (extracted.otherIncomeAmountCents != null || extracted.otherIncomeSource)) {
    patch.otherIncome = { amountCents: extracted.otherIncomeAmountCents, source: extracted.otherIncomeSource };
  }

  return patch;
}
