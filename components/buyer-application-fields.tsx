"use client";

import { useEffect, useRef, useState } from "react";
import { Input, Label, Select } from "@/components/ui/input";
import { AccordionSection } from "@/components/accordion-section";
import type { AddressDetail, EmploymentDetail, OtherIncomeDetail } from "@/schema-sketch/schema";

export interface BuyerApplicationDefaults {
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

function TextField({
  name,
  label,
  defaultValue,
  type = "text",
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string | number | null;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue ?? ""} placeholder={placeholder} />
    </div>
  );
}

function centsToDollarsStr(cents: number | null | undefined): string {
  return cents != null ? (cents / 100).toString() : "";
}

// Full Buyer Info / Address (current + previous) / Employment (current +
// previous) / Other Income section set — shared by New Deal (a blank
// `defaults`) and Customer facts (an existing deal's `defaults`), so the
// same ~50 fields aren't hand-duplicated across both forms. Both callers
// wrap this in their own <form>; this only renders fields, no form/submit
// of its own. Field names match lib/buyer-application.ts's
// buyerApplicationSchema exactly — that's what turns these into the
// deals table's structured jsonb columns on save.
export function BuyerApplicationFields({
  defaults,
  forceOpenSignal,
}: {
  defaults?: Partial<BuyerApplicationDefaults>;
  /** Forces all three sections open — e.g. once a credit app upload has just filled them in. See AccordionSection. */
  forceOpenSignal?: unknown;
}) {
  const d = defaults ?? {};
  const [showPreviousAddress, setShowPreviousAddress] = useState(!!d.previousAddress);
  const [showPreviousEmployment, setShowPreviousEmployment] = useState(!!d.previousEmployment);
  const mounted = useRef(false);

  // A credit app upload fills previous-address/employer fields via direct
  // DOM manipulation (see credit-app-upload-field.tsx), which can't spring
  // these two open on its own the way `defaults` does at mount — so also
  // reveal both blocks whenever the same signal fires. Harmless if a given
  // upload didn't actually have previous-address/employer data; an empty
  // revealed block is a no-op for the customer, not a bug.
  useEffect(() => {
    if (mounted.current && forceOpenSignal !== undefined) {
      setShowPreviousAddress(true);
      setShowPreviousEmployment(true);
    }
    mounted.current = true;
  }, [forceOpenSignal]);

  return (
    <div className="flex flex-col gap-3">
      <AccordionSection title="Buyer info" forceOpenSignal={forceOpenSignal}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="gender">Gender</Label>
            <Select id="gender" name="gender" defaultValue={d.gender ?? ""}>
              <option value="">—</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </Select>
          </div>
          <TextField name="dob" label="Date of birth" type="date" defaultValue={d.dob} />
          <TextField name="ssn" label="SSN" defaultValue={d.ssn} placeholder="XXX-XX-XXXX" />
          <TextField name="homePhone" label="Home phone" type="tel" defaultValue={d.homePhone} placeholder="(555) 123-4567" />
          <TextField name="workPhone" label="Work phone" type="tel" defaultValue={d.workPhone} placeholder="(555) 123-4567" />
          <TextField name="email" label="Email" type="email" defaultValue={d.email} />
        </div>
        <p className="mt-2 text-[10.5px] text-[var(--color-text-placeholder)]">
          SSN stays manual-entry only — an uploaded credit application only ever fills in the last 4 digits shown on
          its own document summary, never the full number here.
        </p>
        <p className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
          ID detail (ID type itself is set under Credit)
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <TextField name="idState" label="ID state" defaultValue={d.idState} placeholder="TX" />
          <TextField name="idNumber" label="ID number" defaultValue={d.idNumber} />
          <TextField name="idIssuedDate" label="ID issued" type="date" defaultValue={d.idIssuedDate} />
          <TextField name="idExpirationDate" label="ID expires" type="date" defaultValue={d.idExpirationDate} />
        </div>
      </AccordionSection>

      <AccordionSection title="Address" forceOpenSignal={forceOpenSignal}>
        <div className="mb-1 text-[11.5px] font-semibold text-[var(--color-text)]">Current address</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="col-span-2">
            <TextField name="currentStreet" label="Street" defaultValue={d.currentAddress?.street} placeholder="123 Main Street" />
          </div>
          <TextField name="currentAptUnit" label="Apt/Unit/Suite" defaultValue={d.currentAddress?.aptUnit} />
          <TextField name="currentCity" label="City" defaultValue={d.currentAddress?.city} />
          <TextField name="currentState" label="State" defaultValue={d.currentAddress?.state} placeholder="TX" />
          <TextField name="currentZip" label="Zip" defaultValue={d.currentAddress?.zip} />
          <TextField name="currentCounty" label="County" defaultValue={d.currentAddress?.county} />
          <div>
            <Label htmlFor="currentAddressType">Rent/Own</Label>
            <Select id="currentAddressType" name="currentAddressType" defaultValue={d.currentAddress?.addressType ?? ""}>
              <option value="">—</option>
              <option value="rent">Rent</option>
              <option value="own">Own</option>
              <option value="live_with_family">Live with family</option>
            </Select>
          </div>
          <TextField name="currentRentMortDollars" label="Rent/mort. amt ($)" type="number" defaultValue={centsToDollarsStr(d.currentAddress?.rentMortCents)} />
          <TextField name="currentAddressYears" label="Years at address" type="number" defaultValue={d.currentAddress?.years} />
          <TextField name="currentAddressMonths" label="Months" type="number" defaultValue={d.currentAddress?.months} />
        </div>

        {showPreviousAddress ? (
          <>
            <div className="mb-1 mt-4 text-[11.5px] font-semibold text-[var(--color-caution-text)]">Previous address</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="col-span-2">
                <TextField name="previousStreet" label="Street" defaultValue={d.previousAddress?.street} />
              </div>
              <TextField name="previousAptUnit" label="Apt/Unit/Suite" defaultValue={d.previousAddress?.aptUnit} />
              <TextField name="previousCity" label="City" defaultValue={d.previousAddress?.city} />
              <TextField name="previousState" label="State" defaultValue={d.previousAddress?.state} />
              <TextField name="previousZip" label="Zip" defaultValue={d.previousAddress?.zip} />
              <TextField name="previousCounty" label="County" defaultValue={d.previousAddress?.county} />
              <div>
                <Label htmlFor="previousAddressType">Rent/Own</Label>
                <Select id="previousAddressType" name="previousAddressType" defaultValue={d.previousAddress?.addressType ?? ""}>
                  <option value="">—</option>
                  <option value="rent">Rent</option>
                  <option value="own">Own</option>
                  <option value="live_with_family">Live with family</option>
                </Select>
              </div>
              <TextField name="previousRentMortDollars" label="Rent/mort. amt ($)" type="number" defaultValue={centsToDollarsStr(d.previousAddress?.rentMortCents)} />
              <TextField name="previousAddressYears" label="Years at address" type="number" defaultValue={d.previousAddress?.years} />
              <TextField name="previousAddressMonths" label="Months" type="number" defaultValue={d.previousAddress?.months} />
            </div>
            <button type="button" onClick={() => setShowPreviousAddress(false)} className="mt-2 text-[11.5px] font-semibold text-[var(--color-negative-text)] hover:underline">
              Remove previous address
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setShowPreviousAddress(true)} className="mt-3 text-[11.5px] font-semibold text-[var(--color-primary)] hover:underline">
            + Add previous address
          </button>
        )}
      </AccordionSection>

      <AccordionSection title="Employment" forceOpenSignal={forceOpenSignal}>
        <div className="mb-1 text-[11.5px] font-semibold text-[var(--color-text)]">Current employer</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="col-span-2">
            <TextField name="employerName" label="Employer name" defaultValue={d.currentEmployment?.employerName} />
          </div>
          <TextField name="occupation" label="Occupation" defaultValue={d.currentEmployment?.occupation} />
          <TextField name="employerPhone" label="Phone" type="tel" defaultValue={d.currentEmployment?.employerPhone} />
          <div>
            <Label htmlFor="employmentStatus">Employment status</Label>
            <Select id="employmentStatus" name="employmentStatus" defaultValue={d.currentEmployment?.employmentStatus ?? ""}>
              <option value="">—</option>
              <option value="Employed - Full Time">Employed - Full Time</option>
              <option value="Employed - Part Time">Employed - Part Time</option>
              <option value="Self-employed">Self-employed</option>
              <option value="Retired">Retired</option>
              <option value="Not employed">Not employed</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="incomeType">Income type</Label>
            <Select id="incomeType" name="incomeType" defaultValue={d.currentEmployment?.incomeType ?? ""}>
              <option value="">—</option>
              <option value="Turbo Pass">Turbo Pass</option>
              <option value="Pay stub">Pay stub</option>
              <option value="Bank statements">Bank statements</option>
              <option value="Self-employed">Self-employed</option>
              <option value="Other">Other</option>
            </Select>
          </div>
          <TextField name="grossSalaryDollars" label="Gross salary ($)" type="number" defaultValue={centsToDollarsStr(d.currentEmployment?.grossSalaryCents)} />
          <TextField name="employmentYears" label="Years at job" type="number" defaultValue={d.currentEmployment?.yearsAtJob} />
          <TextField name="employmentMonths" label="Months" type="number" defaultValue={d.currentEmployment?.monthsAtJob} />
          <div className="col-span-2">
            <TextField name="employerStreet" label="Employer street" defaultValue={d.currentEmployment?.street} />
          </div>
          <TextField name="employerAptUnit" label="Apt/Unit/Suite" defaultValue={d.currentEmployment?.aptUnit} />
          <TextField name="employerCity" label="City" defaultValue={d.currentEmployment?.city} />
          <TextField name="employerState" label="State" defaultValue={d.currentEmployment?.state} />
          <TextField name="employerZip" label="Zip" defaultValue={d.currentEmployment?.zip} />
          <TextField name="employerCounty" label="County" defaultValue={d.currentEmployment?.county} />
        </div>

        {showPreviousEmployment ? (
          <>
            <div className="mb-1 mt-4 text-[11.5px] font-semibold text-[var(--color-caution-text)]">Previous employer</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="col-span-2">
                <TextField name="prevEmployerName" label="Employer name" defaultValue={d.previousEmployment?.employerName} />
              </div>
              <TextField name="prevOccupation" label="Occupation" defaultValue={d.previousEmployment?.occupation} />
              <TextField name="prevEmployerPhone" label="Phone" type="tel" defaultValue={d.previousEmployment?.employerPhone} />
              <div>
                <Label htmlFor="prevEmploymentStatus">Employment status</Label>
                <Select id="prevEmploymentStatus" name="prevEmploymentStatus" defaultValue={d.previousEmployment?.employmentStatus ?? ""}>
                  <option value="">—</option>
                  <option value="Employed - Full Time">Employed - Full Time</option>
                  <option value="Employed - Part Time">Employed - Part Time</option>
                  <option value="Self-employed">Self-employed</option>
                </Select>
              </div>
              <TextField name="prevGrossSalaryDollars" label="Gross salary ($)" type="number" defaultValue={centsToDollarsStr(d.previousEmployment?.grossSalaryCents)} />
              <TextField name="prevEmploymentYears" label="Years at job" type="number" defaultValue={d.previousEmployment?.yearsAtJob} />
              <TextField name="prevEmploymentMonths" label="Months" type="number" defaultValue={d.previousEmployment?.monthsAtJob} />
            </div>
            <button type="button" onClick={() => setShowPreviousEmployment(false)} className="mt-2 text-[11.5px] font-semibold text-[var(--color-negative-text)] hover:underline">
              Remove previous employer
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setShowPreviousEmployment(true)} className="mt-3 text-[11.5px] font-semibold text-[var(--color-primary)] hover:underline">
            + Add previous employer
          </button>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <TextField name="otherIncomeAmountDollars" label="Other income amount ($)" type="number" defaultValue={centsToDollarsStr(d.otherIncome?.amountCents)} />
          <TextField name="otherIncomeSource" label="Other income source" defaultValue={d.otherIncome?.source} />
        </div>
      </AccordionSection>
    </div>
  );
}
