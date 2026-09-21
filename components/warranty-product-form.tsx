"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { warrantyProductTypeValues } from "@/lib/validation";

const TYPE_LABEL: Record<string, string> = {
  vsc: "Vehicle service contract",
  gap: "GAP",
  tire_wheel: "Tire & wheel",
  key_replacement: "Key replacement",
  maintenance: "Maintenance plan",
  other: "Other",
};

export interface WarrantyProductFormValues {
  name: string;
  provider: string;
  productType: (typeof warrantyProductTypeValues)[number];
  costDollars: number;
  priceDollars: number;
  termMonths: number | null;
  termMiles: number | null;
  deductibleDollars: number | null;
  maxVehicleAgeYears: number | null;
  maxVehicleMiles: number | null;
  minSalePriceDollars: number | null;
  maxSalePriceDollars: number | null;
  notes: string | null;
}

export function WarrantyProductForm({
  action,
  initial,
  onCancel,
}: {
  action: (formData: FormData) => void;
  initial?: WarrantyProductFormValues;
  onCancel?: () => void;
}) {
  const uid = useId();
  const id = (field: string) => `${uid}-${field}`;

  return (
    <form action={action} className="mt-2 flex flex-col gap-3 rounded-[var(--radius-panel)] border border-[var(--color-hairline)] p-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1">
          <Label htmlFor={id("name")}>Product name</Label>
          <Input id={id("name")} name="name" required defaultValue={initial?.name ?? ""} placeholder="5yr/100k Powertrain" />
        </div>
        <div>
          <Label htmlFor={id("provider")}>Provider</Label>
          <Input id={id("provider")} name="provider" required defaultValue={initial?.provider ?? ""} placeholder="Assurant" />
        </div>
        <div>
          <Label htmlFor={id("productType")}>Type</Label>
          <Select id={id("productType")} name="productType" defaultValue={initial?.productType ?? "vsc"}>
            {warrantyProductTypeValues.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={id("costDollars")}>Our cost</Label>
          <Input id={id("costDollars")} name="costDollars" type="number" step="0.01" required defaultValue={initial?.costDollars ?? ""} />
        </div>
        <div>
          <Label htmlFor={id("priceDollars")}>Sells for</Label>
          <Input id={id("priceDollars")} name="priceDollars" type="number" step="0.01" required defaultValue={initial?.priceDollars ?? ""} />
        </div>
        <div>
          <Label htmlFor={id("termMonths")}>Term (months)</Label>
          <Input id={id("termMonths")} name="termMonths" type="number" defaultValue={initial?.termMonths ?? ""} />
        </div>
        <div>
          <Label htmlFor={id("termMiles")}>Term (miles added)</Label>
          <Input id={id("termMiles")} name="termMiles" type="number" defaultValue={initial?.termMiles ?? ""} />
        </div>
        <div>
          <Label htmlFor={id("deductibleDollars")}>Deductible</Label>
          <Input id={id("deductibleDollars")} name="deductibleDollars" type="number" step="0.01" defaultValue={initial?.deductibleDollars ?? ""} />
        </div>
        <div>
          <Label htmlFor={id("maxVehicleAgeYears")}>Max vehicle age (years)</Label>
          <Input id={id("maxVehicleAgeYears")} name="maxVehicleAgeYears" type="number" defaultValue={initial?.maxVehicleAgeYears ?? ""} />
        </div>
        <div>
          <Label htmlFor={id("maxVehicleMiles")}>Max vehicle miles</Label>
          <Input id={id("maxVehicleMiles")} name="maxVehicleMiles" type="number" defaultValue={initial?.maxVehicleMiles ?? ""} />
        </div>
        <div>
          <Label htmlFor={id("minSalePriceDollars")}>Min sale price</Label>
          <Input id={id("minSalePriceDollars")} name="minSalePriceDollars" type="number" step="0.01" defaultValue={initial?.minSalePriceDollars ?? ""} />
        </div>
        <div>
          <Label htmlFor={id("maxSalePriceDollars")}>Max sale price</Label>
          <Input id={id("maxSalePriceDollars")} name="maxSalePriceDollars" type="number" step="0.01" defaultValue={initial?.maxSalePriceDollars ?? ""} />
        </div>
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
        <Button type="submit">{initial ? "Save product" : "Add product"}</Button>
      </div>
    </form>
  );
}
