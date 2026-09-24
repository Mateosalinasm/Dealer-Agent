import { z } from "zod";
import type { AddressDetail, EmploymentDetail, OtherIncomeDetail } from "@/schema-sketch/schema";

// The "Buyer Info / Address / Employment / Other Income" fields — shared
// by New Deal (lib/validation.ts's newDealSchema) and Customer facts
// (customerFactsSchema), since both forms post the exact same flat field
// set and need it assembled into the deals table's structured jsonb
// columns (schema-sketch/schema.ts's AddressDetail/EmploymentDetail/
// OtherIncomeDetail) the same way. One place for the shape, one place for
// the flat-to-nested assembly, instead of duplicating both per form.
export const buyerApplicationSchema = z.object({
  gender: z.string().optional(),
  dob: z.string().optional(),
  ssn: z.string().optional(), // full, manual entry only — never AI-populated, see lib/credit-app-merge.ts
  homePhone: z.string().optional(),
  workPhone: z.string().optional(),
  email: z.string().optional(),
  idState: z.string().optional(),
  idNumber: z.string().optional(),
  idIssuedDate: z.string().optional(),
  idExpirationDate: z.string().optional(),

  currentStreet: z.string().optional(),
  currentAptUnit: z.string().optional(),
  currentCity: z.string().optional(),
  currentState: z.string().optional(),
  currentZip: z.string().optional(),
  currentCounty: z.string().optional(),
  currentAddressType: z.string().optional(),
  currentRentMortDollars: z.coerce.number().min(0).optional(),
  currentAddressYears: z.coerce.number().int().min(0).optional(),
  currentAddressMonths: z.coerce.number().int().min(0).max(11).optional(),

  previousStreet: z.string().optional(),
  previousAptUnit: z.string().optional(),
  previousCity: z.string().optional(),
  previousState: z.string().optional(),
  previousZip: z.string().optional(),
  previousCounty: z.string().optional(),
  previousAddressType: z.string().optional(),
  previousRentMortDollars: z.coerce.number().min(0).optional(),
  previousAddressYears: z.coerce.number().int().min(0).optional(),
  previousAddressMonths: z.coerce.number().int().min(0).max(11).optional(),

  employerName: z.string().optional(),
  occupation: z.string().optional(),
  employerPhone: z.string().optional(),
  employmentStatus: z.string().optional(),
  incomeType: z.string().optional(),
  employmentYears: z.coerce.number().int().min(0).optional(),
  employmentMonths: z.coerce.number().int().min(0).max(11).optional(),
  employerStreet: z.string().optional(),
  employerAptUnit: z.string().optional(),
  employerCity: z.string().optional(),
  employerState: z.string().optional(),
  employerZip: z.string().optional(),
  employerCounty: z.string().optional(),

  prevEmployerName: z.string().optional(),
  prevOccupation: z.string().optional(),
  prevEmployerPhone: z.string().optional(),
  prevEmploymentStatus: z.string().optional(),
  prevEmploymentYears: z.coerce.number().int().min(0).optional(),
  prevEmploymentMonths: z.coerce.number().int().min(0).max(11).optional(),

  otherIncomeAmountDollars: z.coerce.number().min(0).optional(),
  otherIncomeSource: z.string().optional(),
});

export type BuyerApplicationInput = z.infer<typeof buyerApplicationSchema>;

// One place that reads every buyerApplicationSchema field off a FormData —
// keeps New Deal and Customer facts from each hand-listing 40+
// formData.get() calls that have to stay in sync with the schema above.
export function buyerApplicationFieldsFromFormData(formData: FormData): Record<string, FormDataEntryValue | undefined> {
  const out: Record<string, FormDataEntryValue | undefined> = {};
  for (const key of Object.keys(buyerApplicationSchema.shape)) {
    const value = formData.get(key);
    if (value != null) out[key] = value;
  }
  return out;
}

export interface BuyerApplicationPatch {
  gender: string | null;
  dob: string | null;
  ssn: string | null;
  homePhone: string | null;
  workPhone: string | null;
  email: string | null;
  idState: string | null;
  idNumber: string | null;
  idIssuedDate: string | null;
  idExpirationDate: string | null;
  currentAddress: AddressDetail | null;
  previousAddress: AddressDetail | null;
  currentEmployment: EmploymentDetail | null;
  previousEmployment: EmploymentDetail | null;
  otherIncome: OtherIncomeDetail | null;
}

function nullIfBlank(v: string | undefined | null): string | null {
  return v && v.trim() ? v.trim() : null;
}

function addressFromInput(p: BuyerApplicationInput, which: "current" | "previous"): AddressDetail | null {
  const street = which === "current" ? p.currentStreet : p.previousStreet;
  const aptUnit = which === "current" ? p.currentAptUnit : p.previousAptUnit;
  const city = which === "current" ? p.currentCity : p.previousCity;
  const state = which === "current" ? p.currentState : p.previousState;
  const zip = which === "current" ? p.currentZip : p.previousZip;
  const county = which === "current" ? p.currentCounty : p.previousCounty;
  const addressType = which === "current" ? p.currentAddressType : p.previousAddressType;
  const rentMortDollars = which === "current" ? p.currentRentMortDollars : p.previousRentMortDollars;
  const years = which === "current" ? p.currentAddressYears : p.previousAddressYears;
  const months = which === "current" ? p.currentAddressMonths : p.previousAddressMonths;

  const hasAny = [street, aptUnit, city, state, zip, county, addressType].some((v) => nullIfBlank(v)) || rentMortDollars != null || years != null || months != null;
  if (!hasAny) return null;

  return {
    street: nullIfBlank(street),
    aptUnit: nullIfBlank(aptUnit),
    city: nullIfBlank(city),
    state: nullIfBlank(state),
    zip: nullIfBlank(zip),
    county: nullIfBlank(county),
    addressType: nullIfBlank(addressType),
    rentMortCents: rentMortDollars != null ? Math.round(rentMortDollars * 100) : null,
    years: years ?? null,
    months: months ?? null,
  };
}

function employmentFromInput(p: BuyerApplicationInput, which: "current" | "previous"): EmploymentDetail | null {
  const employerName = which === "current" ? p.employerName : p.prevEmployerName;
  const occupation = which === "current" ? p.occupation : p.prevOccupation;
  const employerPhone = which === "current" ? p.employerPhone : p.prevEmployerPhone;
  const employmentStatus = which === "current" ? p.employmentStatus : p.prevEmploymentStatus;
  const incomeType = which === "current" ? p.incomeType : null;
  const years = which === "current" ? p.employmentYears : p.prevEmploymentYears;
  const months = which === "current" ? p.employmentMonths : p.prevEmploymentMonths;
  const street = which === "current" ? p.employerStreet : null;
  const aptUnit = which === "current" ? p.employerAptUnit : null;
  const city = which === "current" ? p.employerCity : null;
  const state = which === "current" ? p.employerState : null;
  const zip = which === "current" ? p.employerZip : null;
  const county = which === "current" ? p.employerCounty : null;

  const hasAny = [employerName, occupation, employerPhone, employmentStatus, incomeType, street, city].some((v) => nullIfBlank(v)) || years != null || months != null;
  if (!hasAny) return null;

  return {
    employerName: nullIfBlank(employerName),
    occupation: nullIfBlank(occupation),
    employerPhone: nullIfBlank(employerPhone),
    employmentStatus: nullIfBlank(employmentStatus),
    incomeType: nullIfBlank(incomeType),
    yearsAtJob: years ?? null,
    monthsAtJob: months ?? null,
    street: nullIfBlank(street),
    aptUnit: nullIfBlank(aptUnit),
    city: nullIfBlank(city),
    state: nullIfBlank(state),
    zip: nullIfBlank(zip),
    county: nullIfBlank(county),
  };
}

export function buyerApplicationPatch(p: BuyerApplicationInput): BuyerApplicationPatch {
  return {
    gender: nullIfBlank(p.gender),
    dob: nullIfBlank(p.dob),
    ssn: nullIfBlank(p.ssn),
    homePhone: nullIfBlank(p.homePhone),
    workPhone: nullIfBlank(p.workPhone),
    email: nullIfBlank(p.email),
    idState: nullIfBlank(p.idState),
    idNumber: nullIfBlank(p.idNumber),
    idIssuedDate: nullIfBlank(p.idIssuedDate),
    idExpirationDate: nullIfBlank(p.idExpirationDate),
    currentAddress: addressFromInput(p, "current"),
    previousAddress: addressFromInput(p, "previous"),
    currentEmployment: employmentFromInput(p, "current"),
    previousEmployment: employmentFromInput(p, "previous"),
    otherIncome:
      p.otherIncomeAmountDollars != null || nullIfBlank(p.otherIncomeSource)
        ? { amountCents: p.otherIncomeAmountDollars != null ? Math.round(p.otherIncomeAmountDollars * 100) : null, source: nullIfBlank(p.otherIncomeSource) }
        : null,
  };
}
