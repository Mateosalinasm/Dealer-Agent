"use client";

import { useMemo, useState, useTransition } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { createAppointment } from "@/app/desk/deals/actions";
import type { bodyType } from "@/schema-sketch/schema";

type BodyType = (typeof bodyType)[number];
const BODY_LABEL: Record<BodyType, string> = { truck: "Truck", sedan: "Sedan", suv: "SUV" };
const VEHICLE_MODES = ["none", "generic", "specific"] as const;
type VehicleMode = (typeof VEHICLE_MODES)[number];
const VEHICLE_MODE_LABEL: Record<VehicleMode, string> = { none: "None", generic: "Body type", specific: "Specific unit" };

interface VehicleOption {
  id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  stockNumber: string | null;
}

function vehicleLabel(v: VehicleOption) {
  return [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
}

// Schedule appointment, opened as a secondary modal from inside the deal
// (see components/deal-detail-view.tsx) instead of navigating away to
// /desk/appointments — the deal underneath stays open behind it.
export function ScheduleAppointmentModal({
  dealId,
  customerName,
  phone,
  vehicles,
}: {
  dealId: string;
  customerName: string;
  phone: string | null;
  vehicles: VehicleOption[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [vehicleMode, setVehicleMode] = useState<VehicleMode>("none");
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");

  const matches = useMemo(() => {
    const q = vehicleQuery.trim().toLowerCase();
    const pool = q ? vehicles.filter((v) => vehicleLabel(v).toLowerCase().includes(q) || (v.stockNumber ?? "").toLowerCase().includes(q)) : vehicles;
    return pool.slice(0, 6);
  }, [vehicles, vehicleQuery]);

  function submit(formData: FormData) {
    const date = formData.get("date");
    const time = formData.get("time");
    formData.set("scheduledAt", `${date}T${time || "00:00"}`);
    formData.delete("date");
    formData.delete("time");
    formData.set("dealId", dealId);
    startTransition(async () => {
      await createAppointment(formData);
      setOpen(false);
      setVehicleMode("none");
      setVehicleQuery("");
      setSelectedVehicleId("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary">
          Schedule appointment
        </Button>
      </DialogTrigger>
      <DialogContent title="Schedule appointment" className="max-w-lg">
        <form action={submit} className="flex flex-col gap-3">
          <div>
            <Label htmlFor="ap-customerName">Customer</Label>
            <Input id="ap-customerName" name="customerName" required defaultValue={customerName} />
          </div>
          <div>
            <Label htmlFor="ap-phone">Phone (optional)</Label>
            <Input id="ap-phone" name="phone" type="tel" defaultValue={phone ?? ""} placeholder="(555) 123-4567" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ap-date">Date</Label>
              <Input id="ap-date" name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <div>
              <Label htmlFor="ap-time">Time</Label>
              <Input id="ap-time" name="time" type="time" required defaultValue="09:00" />
            </div>
          </div>

          <div>
            <Label>Vehicle</Label>
            <div className="mb-2 flex gap-1 rounded-[var(--radius-pill)] bg-[var(--color-fill-subtle)] p-0.5">
              {VEHICLE_MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setVehicleMode(m)}
                  className={`flex-1 rounded-[var(--radius-pill)] px-2.5 py-1 text-[11px] font-semibold ${
                    vehicleMode === m ? "bg-[var(--color-text)] text-[var(--color-surface)]" : "text-[var(--color-text-muted)]"
                  }`}
                >
                  {VEHICLE_MODE_LABEL[m]}
                </button>
              ))}
            </div>

            {vehicleMode === "generic" && (
              <Select name="vehicleBodyType" defaultValue="">
                <option value="">Select a body type</option>
                {(Object.keys(BODY_LABEL) as BodyType[]).map((bt) => (
                  <option key={bt} value={bt}>
                    {BODY_LABEL[bt]}
                  </option>
                ))}
              </Select>
            )}

            {vehicleMode === "specific" && (
              <div>
                <Input
                  value={selectedVehicleId ? vehicleLabel(vehicles.find((v) => v.id === selectedVehicleId)!) : vehicleQuery}
                  onChange={(e) => {
                    setSelectedVehicleId("");
                    setVehicleQuery(e.target.value);
                  }}
                  placeholder="Start typing — inventory autocompletes"
                  autoComplete="off"
                />
                <input type="hidden" name="vehicleId" value={selectedVehicleId} />
                {!selectedVehicleId && matches.length > 0 && (
                  <div className="mt-1 flex flex-col gap-0.5 rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] p-1">
                    {matches.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setSelectedVehicleId(v.id);
                          setVehicleQuery("");
                        }}
                        className="rounded-[var(--radius-panel)] px-2 py-1.5 text-left text-[12.5px] text-[var(--color-text)] hover:bg-[var(--color-surface)]"
                      >
                        {vehicleLabel(v)}
                        {v.stockNumber ? ` · #${v.stockNumber}` : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="ap-notes">Notes (optional)</Label>
            <Textarea id="ap-notes" name="notes" rows={3} placeholder="What they're coming in for" />
          </div>

          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Scheduling…" : "Schedule"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
