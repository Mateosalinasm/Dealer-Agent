"use client";

import { useMemo, useState } from "react";
import { Car, CarFront, Truck } from "lucide-react";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BuyerApplicationFields } from "@/components/buyer-application-fields";
import { formatCents } from "@/lib/utils";
import { createDeal } from "@/app/desk/deals/actions";
import type { bodyType } from "@/schema-sketch/schema";

type BodyType = (typeof bodyType)[number];

export interface VehicleOption {
  id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  stockNumber: string | null;
  askingPrice: number | null;
  bodyType: BodyType | null;
}

const BODY_LABEL: Record<BodyType, string> = { truck: "Truck", sedan: "Sedan", suv: "SUV" };
// lucide-react has no dedicated SUV glyph — CarFront (a taller, boxier
// front-on silhouette) is the closest stand-in.
const BODY_ICON: Record<BodyType, typeof Truck> = { truck: Truck, sedan: Car, suv: CarFront };
const BODY_TYPES: BodyType[] = ["truck", "sedan", "suv"];

function vehicleLabel(v: VehicleOption) {
  return [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
}

export function NewDealForm({
  vehicles,
  lenders,
  forceOpenSignal,
}: {
  vehicles: VehicleOption[];
  lenders: { id: string; name: string }[];
  /** Forces the buyer-application sections open — e.g. once a credit app upload has just filled them in. */
  forceOpenSignal?: unknown;
}) {
  const [bodyFilter, setBodyFilter] = useState<BodyType | null>(null);
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");

  const countByBody = useMemo(() => {
    const counts: Record<BodyType, number> = { truck: 0, sedan: 0, suv: 0 };
    for (const v of vehicles) if (v.bodyType) counts[v.bodyType]++;
    return counts;
  }, [vehicles]);

  const matches = useMemo(() => {
    const q = vehicleQuery.trim().toLowerCase();
    return vehicles
      .filter((v) => !bodyFilter || v.bodyType === bodyFilter)
      .filter((v) => !q || vehicleLabel(v).toLowerCase().includes(q) || (v.stockNumber ?? "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [vehicles, bodyFilter, vehicleQuery]);

  return (
    <form id="new-deal-form" action={createDeal} className="grid grid-cols-1 gap-4 md:grid-cols-[1.3fr_1fr]">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="customerName">Customer</Label>
            <Input id="customerName" name="customerName" required placeholder="First Last" />
          </div>
          <div>
            <Label htmlFor="phone">Cell phone (WhatsApp)</Label>
            <Input id="phone" name="phone" type="tel" placeholder="(555) 123-4567" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="idType">ID type</Label>
            <Select id="idType" name="idType" defaultValue="US ID">
              <option value="US ID">US ID</option>
              <option value="US Driver's License">US Driver&apos;s License</option>
              <option value="ITIN">ITIN</option>
              <option value="Foreign passport">Foreign passport</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="cashDownDollars">Cash down ($)</Label>
            <Input id="cashDownDollars" name="cashDownDollars" type="number" step="1" min={0} placeholder="2500" />
          </div>
        </div>

        <div>
          <Label htmlFor="statedIncomeDollars">Monthly income ($)</Label>
          <Input id="statedIncomeDollars" name="statedIncomeDollars" type="number" step="1" min={0} placeholder="3800" />
        </div>

        <div>
          <Label>What are they looking for?</Label>
          <div className="grid grid-cols-3 gap-2">
            {BODY_TYPES.map((bt) => {
              const Icon = BODY_ICON[bt];
              return (
                <button
                  key={bt}
                  type="button"
                  onClick={() => setBodyFilter((prev) => (prev === bt ? null : bt))}
                  className={`flex flex-col items-center gap-1 rounded-[var(--radius-panel)] border p-3 text-center ${
                    bodyFilter === bt ? "border-[var(--color-primary)] bg-[var(--color-info-bg)]" : "border-[var(--color-hairline)] hover:bg-[var(--color-fill-subtle)]"
                  }`}
                >
                  <Icon size={20} className={bodyFilter === bt ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"} />
                  <div className="text-[13px] font-semibold text-[var(--color-text)]">{BODY_LABEL[bt]}</div>
                  <div className="text-[11px] text-[var(--color-text-muted)]">{countByBody[bt]} in stock</div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label htmlFor="vehicleQuery">Vehicle</Label>
          <Input
            id="vehicleQuery"
            value={selectedVehicleId ? vehicleLabel(vehicles.find((v) => v.id === selectedVehicleId)!) : vehicleQuery}
            onChange={(e) => {
              setSelectedVehicleId("");
              setVehicleQuery(e.target.value);
            }}
            placeholder="Start typing — inventory autocompletes"
            autoComplete="off"
          />
          <input type="hidden" name="vehicleId" value={selectedVehicleId} />
          <input type="hidden" name="wantBodyType" value={bodyFilter ?? ""} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="lenderId">Bank</Label>
            <Select id="lenderId" name="lenderId" defaultValue="">
              <option value="">Pending submission</option>
              {lenders.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="dealDate">Deal date</Label>
            <Input id="dealDate" name="dealDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
        </div>

        <div>
          <Label htmlFor="lot">Lot</Label>
          <Input id="lot" name="lot" placeholder="Main lot / North lot / trade from..." />
        </div>

        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea id="notes" name="notes" rows={2} placeholder="How they found us, what they want, etc." />
        </div>
      </div>

      <div className="rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] p-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">Matches in inventory</div>
        {matches.length === 0 ? (
          <p className="text-[12px] text-[var(--color-text-muted)]">Pick a body type or type a year, make or stock number.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {matches.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setSelectedVehicleId(v.id);
                  setVehicleQuery("");
                }}
                className={`flex items-center justify-between gap-2 rounded-[var(--radius-panel)] px-2.5 py-2 text-left ${
                  selectedVehicleId === v.id ? "bg-[var(--color-info-bg)]" : "hover:bg-[var(--color-surface)]"
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] font-semibold text-[var(--color-text)]">{vehicleLabel(v)}</div>
                  <div className="text-[11px] text-[var(--color-text-muted)]">{v.stockNumber ? `Stock #${v.stockNumber}` : "No stock #"}</div>
                </div>
                <div className="flex-none text-[12px] font-semibold tabular-nums text-[var(--color-text)]">{formatCents(v.askingPrice)}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="md:col-span-2">
        <BuyerApplicationFields forceOpenSignal={forceOpenSignal} />
      </div>

      <div className="mt-1 flex justify-end gap-2 md:col-span-2">
        <Button type="submit">Add deal</Button>
      </div>
    </form>
  );
}
