"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/utils";
import { analyzeAutocheckDraft, createVehicleManually, deleteAutocheckDraft, uploadAutocheckDraft } from "@/app/inventory/actions";
import type { titleStatusValues } from "@/lib/validation";

type TitleStatus = (typeof titleStatusValues)[number];

interface AutocheckData {
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  currentMileage: number | null;
  titleBrand: string | null;
  ownerCount: number | null;
  accidentsReported: number | null;
  odometerReadings: { date: string | null; miles: number | null; source: string | null }[];
  odometerConsistent: boolean | null;
  notes: string | null;
}

const emptyForm = {
  stockNumber: "",
  vin: "",
  year: "",
  make: "",
  model: "",
  trim: "",
  color: "",
  title: "clean" as TitleStatus,
  bodyType: "",
  miles: "",
  price: "",
  cost: "",
  lot: "",
  daysOnLot: "0",
};

export function AddVehicleModal() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [autocheckDocId, setAutocheckDocId] = useState<string | null>(null);
  const [autocheckFileName, setAutocheckFileName] = useState("");
  const [autocheckStatus, setAutocheckStatus] = useState<"idle" | "uploading" | "analyzing" | "done" | "failed">("idle");
  const [autocheckError, setAutocheckError] = useState("");
  const [autocheckData, setAutocheckData] = useState<AutocheckData | null>(null);

  const room = useMemo(() => {
    const price = Number(form.price);
    const cost = Number(form.cost);
    if (!form.price || !form.cost || Number.isNaN(price) || Number.isNaN(cost)) return null;
    return Math.round((price - cost) * 100);
  }, [form.price, form.cost]);

  function set<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetAll() {
    setForm(emptyForm);
    setAutocheckDocId(null);
    setAutocheckFileName("");
    setAutocheckStatus("idle");
    setAutocheckError("");
    setAutocheckData(null);
  }

  async function handleAutocheckFile(file: File) {
    setAutocheckFileName(file.name);
    setAutocheckStatus("uploading");
    setAutocheckError("");
    const fd = new FormData();
    fd.set("file", file);
    const { documentId } = await uploadAutocheckDraft(fd);
    setAutocheckDocId(documentId);

    setAutocheckStatus("analyzing");
    const result = await analyzeAutocheckDraft(documentId);
    if (result.ok && result.data) {
      const d = result.data as AutocheckData;
      setAutocheckData(d);
      setAutocheckStatus("done");
      // Pre-fill the form from what AutoCheck read — still editable below.
      setForm((prev) => ({
        ...prev,
        vin: d.vin || prev.vin,
        year: d.year != null ? String(d.year) : prev.year,
        make: d.make || prev.make,
        model: d.model || prev.model,
        trim: d.trim || prev.trim,
        miles: d.currentMileage != null ? String(d.currentMileage) : prev.miles,
      }));
    } else {
      setAutocheckStatus("failed");
      setAutocheckError(result.error ?? "Couldn't read this file.");
    }
  }

  function handleClose(next: boolean) {
    setOpen(next);
    if (!next) {
      // Modal closed without submitting — don't leave an orphan document.
      if (autocheckDocId) void deleteAutocheckDraft(autocheckDocId);
      resetAll();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button type="button">Add vehicle</Button>
      </DialogTrigger>
      <DialogContent
        title="Add vehicle"
        className="max-w-3xl"
        headerExtra={
          <label className="flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-text)] hover:bg-[var(--color-fill-subtle)]">
            {autocheckStatus === "uploading" || autocheckStatus === "analyzing" ? "Reading…" : "Upload AutoCheck"}
            <input
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              disabled={autocheckStatus === "uploading" || autocheckStatus === "analyzing"}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAutocheckFile(file);
              }}
            />
          </label>
        }
      >
        <form
          action={async (fd) => {
            if (autocheckDocId) fd.set("autocheckDocumentId", autocheckDocId);
            await createVehicleManually(fd);
            resetAll();
            setOpen(false);
          }}
          className="grid grid-cols-1 gap-4 md:grid-cols-[1.4fr_1fr]"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="av-stock">Stock #</Label>
              <Input id="av-stock" name="stockNumber" value={form.stockNumber} onChange={(e) => set("stockNumber", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="av-year">Year</Label>
              <Input id="av-year" name="year" type="number" value={form.year} onChange={(e) => set("year", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="av-make">Make</Label>
              <Input id="av-make" name="make" value={form.make} onChange={(e) => set("make", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="av-model">Model</Label>
              <Input id="av-model" name="model" value={form.model} onChange={(e) => set("model", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="av-miles">Miles</Label>
              <Input id="av-miles" name="miles" type="number" value={form.miles} onChange={(e) => set("miles", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="av-price">Price</Label>
              <Input id="av-price" name="priceDollars" type="number" step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="av-title">Title</Label>
              <Select id="av-title" name="title" value={form.title} onChange={(e) => set("title", e.target.value as TitleStatus)}>
                <option value="clean">Clean</option>
                <option value="salvage">Salvage</option>
                <option value="rebuilt">Rebuilt</option>
                <option value="flood">Flood</option>
                <option value="lemon">Lemon</option>
                <option value="branded">Branded</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="av-body">Body</Label>
              <Select id="av-body" name="bodyType" value={form.bodyType} onChange={(e) => set("bodyType", e.target.value)}>
                <option value="">—</option>
                <option value="truck">Truck</option>
                <option value="sedan">Sedan</option>
                <option value="suv">SUV</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="av-trim">Trim</Label>
              <Input id="av-trim" name="trim" value={form.trim} onChange={(e) => set("trim", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="av-cost">Cost</Label>
              <Input id="av-cost" name="costDollars" type="number" step="0.01" value={form.cost} onChange={(e) => set("cost", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="av-color">Color</Label>
              <Input id="av-color" name="color" value={form.color} onChange={(e) => set("color", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="av-lot">Lot it came from</Label>
              <Input id="av-lot" name="lot" placeholder="Main lot" value={form.lot} onChange={(e) => set("lot", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="av-days">Days on the lot</Label>
              <Input id="av-days" name="daysOnLot" type="number" min={0} value={form.daysOnLot} onChange={(e) => set("daysOnLot", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="av-vin">VIN</Label>
              <Input id="av-vin" name="vin" placeholder="17-digit VIN" value={form.vin} onChange={(e) => set("vin", e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-3">
          <div className="rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] p-4">
            <div className="mb-1 text-[13.5px] font-semibold text-[var(--color-text)]">AutoCheck</div>
            {autocheckStatus === "idle" && (
              <p className="text-[11.5px] text-[var(--color-text-muted)]">
                Upload at the top right to fill in the VIN, year, make, model, trim and mileage, and flag any
                odometer rollback.
              </p>
            )}
            {(autocheckStatus === "uploading" || autocheckStatus === "analyzing") && (
              <p className="text-[11.5px] text-[var(--color-text-muted)]">
                {autocheckStatus === "uploading" ? "Uploading" : "Reading"} {autocheckFileName}…
              </p>
            )}
            {autocheckStatus === "failed" && (
              <p className="text-[11.5px] text-[var(--color-negative-text)]">{autocheckError}</p>
            )}
            {autocheckStatus === "done" && autocheckData && (
              <div>
                {autocheckData.titleBrand && autocheckData.titleBrand.toLowerCase() !== "clean" && (
                  <div className="mb-2 rounded-[var(--radius-panel)] bg-[var(--color-negative-bg)] p-2.5 text-[11.5px] text-[var(--color-negative-text)]">
                    <div className="font-semibold">{autocheckData.titleBrand}</div>
                    {autocheckData.notes && <div className="mt-0.5">{autocheckData.notes}</div>}
                  </div>
                )}
                {autocheckData.odometerReadings.length > 0 && (
                  <div className={`mb-2 rounded-[var(--radius-panel)] p-2.5 text-[11.5px] ${autocheckData.odometerConsistent === false ? "bg-[var(--color-negative-bg)] text-[var(--color-negative-text)]" : "bg-[var(--color-positive-bg)] text-[var(--color-positive-text)]"}`}>
                    {autocheckData.odometerReadings.length} reading{autocheckData.odometerReadings.length === 1 ? "" : "s"},{" "}
                    {autocheckData.odometerConsistent === false ? "one rolls backward — verify" : "every one consistent"}
                  </div>
                )}
                <div className="text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">Odometer history</div>
                <div className="mt-1 flex max-h-[210px] flex-col gap-1.5 overflow-auto">
                  {autocheckData.odometerReadings.map((r, i) => (
                    <div key={i} className="flex items-baseline gap-2.5">
                      <div className="w-[72px] flex-none tabular-nums text-[11.5px] text-[var(--color-text-muted)]">{r.date ?? "—"}</div>
                      <div className="flex-none text-[12px] font-semibold tabular-nums">{r.miles != null ? r.miles.toLocaleString() : "—"}</div>
                      <div className="min-w-0 truncate text-[11px] text-[var(--color-text-muted)]">{r.source ?? ""}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] p-3">
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="text-[var(--color-text-muted)]">Room between price and cost</span>
              <span className="tabular-nums font-semibold text-[var(--color-text)]">{room != null ? formatCents(room) : "—"}</span>
            </div>
            {room == null && <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">Enter a price and a cost to see the room.</p>}
          </div>
          </div>

          <div className="col-span-full flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button type="submit">Add vehicle</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
