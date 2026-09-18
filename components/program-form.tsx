"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { titleStatusValues } from "@/lib/validation";

const TITLE_LABEL: Record<string, string> = {
  clean: "Clean",
  salvage: "Salvage",
  rebuilt: "Rebuilt",
  flood: "Flood",
  lemon: "Lemon",
  branded: "Branded",
};

export interface ProgramFormValues {
  label: string;
  advancePct: number;
  maxLtvPct: number | null;
  maxTermMonths: number | null;
  maxMiles: number | null;
  maxAgeYears: number | null;
  acquisitionFeeDollars: number;
  minCreditScore: number | null;
  maxPtiPct: number | null;
  typicalAprPct: number | null;
  allowedTitles: string[] | null;
  notes: string | null;
}

export function ProgramForm({
  action,
  initial,
  onCancel,
}: {
  action: (formData: FormData) => void;
  initial?: ProgramFormValues;
  onCancel?: () => void;
}) {
  // Every field id is namespaced to this instance — this form can render
  // more than once on the page at a time (an add-form next to another
  // program's edit-form), and duplicate DOM ids break label association.
  const uid = useId();
  const id = (field: string) => `${uid}-${field}`;

  return (
    <form
      action={action}
      className="mt-2 flex flex-col gap-3 rounded-[var(--radius-panel)] border border-[var(--color-hairline)] p-3"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1">
          <Label htmlFor={id("label")}>Program name</Label>
          <Input id={id("label")} name="label" required defaultValue={initial?.label ?? ""} placeholder="Standard" />
        </div>
        <div>
          <Label htmlFor={id("advancePct")}>Advance % of book</Label>
          <Input
            id={id("advancePct")}
            name="advancePct"
            type="number"
            required
            defaultValue={initial?.advancePct ?? ""}
            placeholder="90"
          />
        </div>
        <div>
          <Label htmlFor={id("maxLtvPct")}>Max LTV %</Label>
          <Input id={id("maxLtvPct")} name="maxLtvPct" type="number" defaultValue={initial?.maxLtvPct ?? ""} />
        </div>
        <div>
          <Label htmlFor={id("maxTermMonths")}>Max term (months)</Label>
          <Input id={id("maxTermMonths")} name="maxTermMonths" type="number" defaultValue={initial?.maxTermMonths ?? ""} />
        </div>
        <div>
          <Label htmlFor={id("maxMiles")}>Max miles</Label>
          <Input id={id("maxMiles")} name="maxMiles" type="number" defaultValue={initial?.maxMiles ?? ""} />
        </div>
        <div>
          <Label htmlFor={id("maxAgeYears")}>Max age (years)</Label>
          <Input id={id("maxAgeYears")} name="maxAgeYears" type="number" defaultValue={initial?.maxAgeYears ?? ""} />
        </div>
        <div>
          <Label htmlFor={id("acquisitionFeeDollars")}>Acquisition fee</Label>
          <Input
            id={id("acquisitionFeeDollars")}
            name="acquisitionFeeDollars"
            type="number"
            step="0.01"
            defaultValue={initial?.acquisitionFeeDollars ?? ""}
          />
        </div>
        <div>
          <Label htmlFor={id("minCreditScore")}>Min credit score</Label>
          <Input id={id("minCreditScore")} name="minCreditScore" type="number" defaultValue={initial?.minCreditScore ?? ""} />
        </div>
        <div>
          <Label htmlFor={id("maxPtiPct")}>Max PTI %</Label>
          <Input id={id("maxPtiPct")} name="maxPtiPct" type="number" defaultValue={initial?.maxPtiPct ?? ""} />
        </div>
        <div>
          <Label htmlFor={id("typicalAprPct")}>Typical APR %</Label>
          <Input
            id={id("typicalAprPct")}
            name="typicalAprPct"
            type="number"
            step="0.01"
            defaultValue={initial?.typicalAprPct ?? ""}
          />
        </div>
      </div>

      <div>
        <Label>Allowed titles</Label>
        <div className="flex flex-wrap gap-3">
          {titleStatusValues.map((t) => (
            <label key={t} className="flex items-center gap-1.5 text-[12.5px] text-[var(--color-text)]">
              <input
                type="checkbox"
                name="allowedTitles"
                value={t}
                defaultChecked={initial?.allowedTitles?.includes(t) ?? (t === "clean" && !initial)}
                className="h-3.5 w-3.5 rounded accent-[var(--color-primary)]"
              />
              {TITLE_LABEL[t]}
            </label>
          ))}
        </div>
        <p className="mt-1 text-[10.5px] text-[var(--color-text-muted)]">Leave all unchecked to allow any title.</p>
      </div>

      <div>
        <Label htmlFor={id("notes")}>Notes</Label>
        <Textarea id={id("notes")} name="notes" rows={2} defaultValue={initial?.notes ?? ""} />
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit">{initial ? "Save program" : "Add program"}</Button>
      </div>
    </form>
  );
}
