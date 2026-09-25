"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateVehicle } from "@/app/inventory/actions";
import type { titleStatusValues } from "@/lib/validation";

type TitleStatus = (typeof titleStatusValues)[number];
type FuelType = "gas" | "diesel" | "hybrid" | "electric";

export interface EditableVehicle {
  id: string;
  stockNumber: string | null;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  color: string | null;
  bodyType: "truck" | "sedan" | "suv" | null;
  title: TitleStatus;
  miles: number | null;
  askingPrice: number | null;
  hammer: number | null;
  buyFee: number | null;
  tow: number;
  recon: number;
  lot: string | null;
  acquiredOn: string | null;
  fuelType: FuelType;
  isThreeRowSuv: boolean;
  notes: string | null;
}

function centsToDollarsStr(cents: number | null | undefined): string {
  return cents != null ? (cents / 100).toFixed(2) : "";
}

export function EditVehicleModal({ vehicle }: { vehicle: EditableVehicle }) {
  const [open, setOpen] = useState(false);
  const [bodyType, setBodyType] = useState(vehicle.bodyType ?? "");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" className="flex items-center gap-1.5 px-3 py-1.5 text-[12px]">
          <Pencil size={13} /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent title="Edit vehicle" className="max-w-2xl">
        <form
          action={async (fd) => {
            await updateVehicle(vehicle.id, fd);
            setOpen(false);
          }}
          className="grid grid-cols-2 gap-3"
        >
          <div>
            <Label htmlFor="ev-stock">Stock #</Label>
            <Input id="ev-stock" name="stockNumber" defaultValue={vehicle.stockNumber ?? ""} />
          </div>
          <div>
            <Label htmlFor="ev-year">Year</Label>
            <Input id="ev-year" name="year" type="number" defaultValue={vehicle.year ?? ""} />
          </div>
          <div>
            <Label htmlFor="ev-make">Make</Label>
            <Input id="ev-make" name="make" defaultValue={vehicle.make ?? ""} />
          </div>
          <div>
            <Label htmlFor="ev-model">Model</Label>
            <Input id="ev-model" name="model" defaultValue={vehicle.model ?? ""} />
          </div>
          <div>
            <Label htmlFor="ev-trim">Trim</Label>
            <Input id="ev-trim" name="trim" defaultValue={vehicle.trim ?? ""} />
          </div>
          <div>
            <Label htmlFor="ev-color">Color</Label>
            <Input id="ev-color" name="color" defaultValue={vehicle.color ?? ""} />
          </div>
          <div>
            <Label htmlFor="ev-title">Title</Label>
            <Select id="ev-title" name="title" defaultValue={vehicle.title}>
              <option value="clean">Clean</option>
              <option value="salvage">Salvage</option>
              <option value="rebuilt">Rebuilt</option>
              <option value="flood">Flood</option>
              <option value="lemon">Lemon</option>
              <option value="branded">Branded</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="ev-body">Body</Label>
            <Select id="ev-body" name="bodyType" value={bodyType} onChange={(e) => setBodyType(e.target.value as "truck" | "sedan" | "suv" | "")}>
              <option value="">—</option>
              <option value="truck">Truck</option>
              <option value="sedan">Sedan</option>
              <option value="suv">SUV</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="ev-fuel">Fuel</Label>
            <Select id="ev-fuel" name="fuelType" defaultValue={vehicle.fuelType}>
              <option value="gas">Gas</option>
              <option value="diesel">Diesel</option>
              <option value="hybrid">Hybrid</option>
              <option value="electric">Electric</option>
            </Select>
          </div>
          {bodyType === "suv" && (
            <div className="col-span-2 flex items-center">
              <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-[var(--color-text)]">
                <input
                  type="checkbox"
                  name="isThreeRowSuv"
                  defaultChecked={vehicle.isThreeRowSuv}
                  className="h-4 w-4 rounded border-[var(--color-hairline)] accent-[var(--color-primary)]"
                />
                Big 3-row SUV (Tahoe, Suburban, etc.)
              </label>
            </div>
          )}
          <div>
            <Label htmlFor="ev-vin">VIN</Label>
            <Input id="ev-vin" name="vin" defaultValue={vehicle.vin ?? ""} />
          </div>
          <div>
            <Label htmlFor="ev-miles">Miles</Label>
            <Input id="ev-miles" name="miles" type="number" defaultValue={vehicle.miles ?? ""} />
          </div>
          <div>
            <Label htmlFor="ev-lot">Lot</Label>
            <Input id="ev-lot" name="lot" placeholder="Main lot" defaultValue={vehicle.lot ?? ""} />
          </div>
          <div>
            <Label htmlFor="ev-acquired">Acquired on</Label>
            <Input id="ev-acquired" name="acquiredOn" type="date" defaultValue={vehicle.acquiredOn ?? ""} />
          </div>

          <div className="col-span-2 mt-1 border-t border-[var(--color-hairline)] pt-3 text-[12.5px] font-semibold text-[var(--color-text)]">
            Pricing
          </div>
          <div>
            <Label htmlFor="ev-price">Asking price ($)</Label>
            <Input id="ev-price" name="priceDollars" type="number" step="0.01" defaultValue={centsToDollarsStr(vehicle.askingPrice)} />
          </div>
          <div className="col-span-2">
            <Label htmlFor="ev-cost">Cost ($)</Label>
            <Input
              id="ev-cost"
              name="costDollars"
              type="number"
              step="0.01"
              defaultValue={centsToDollarsStr((vehicle.hammer ?? 0) + (vehicle.buyFee ?? 0) + vehicle.tow + vehicle.recon)}
            />
            <p className="mt-1 text-[10.5px] text-[var(--color-text-muted)]">The all-in cost shown as &ldquo;Cost&rdquo; on the inventory list.</p>
          </div>

          <div className="col-span-2">
            <Label htmlFor="ev-notes">Notes</Label>
            <Textarea id="ev-notes" name="notes" rows={2} defaultValue={vehicle.notes ?? ""} />
          </div>

          <div className="col-span-2 flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
