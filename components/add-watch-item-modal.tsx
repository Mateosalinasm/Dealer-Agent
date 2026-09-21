"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { HOUSE_FEES, type House } from "@/schema-sketch/bid-math";
import { titleStatusValues } from "@/lib/validation";
import { addToWatchList } from "@/app/sourcing/run-list/actions";

const TITLE_LABEL: Record<string, string> = {
  clean: "Clean",
  salvage: "Salvage",
  rebuilt: "Rebuilt",
  flood: "Flood",
  lemon: "Lemon",
  branded: "Branded",
};

// The manual-entry counterpart to pricing a run list (components/run-list-workspace.tsx),
// which is otherwise the only way a unit lands on the watch-list. Same
// server action (addToWatchList) — this is just a one-off single-row form
// instead of pasting/parsing a whole run.
export function AddWatchItemModal() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      await addToWatchList({
        house: formData.get("house") as House,
        runNumber: String(formData.get("runNumber") ?? ""),
        year: String(formData.get("year") ?? ""),
        make: String(formData.get("make") ?? ""),
        model: String(formData.get("model") ?? ""),
        trim: String(formData.get("trim") ?? ""),
        miles: String(formData.get("miles") ?? ""),
        vin: String(formData.get("vin") ?? ""),
        title: formData.get("title") as (typeof titleStatusValues)[number],
        retailDollars: String(formData.get("retailDollars") ?? ""),
        wholesaleDollars: String(formData.get("wholesaleDollars") ?? ""),
        reconDollars: String(formData.get("reconDollars") ?? ""),
        announcements: String(formData.get("announcements") ?? ""),
      });
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary">
          Add unit
        </Button>
      </DialogTrigger>
      <DialogContent title="Add a unit" subtitle="Watch-list" className="max-w-xl">
        <form action={submit} className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="house">House</Label>
            <Select id="house" name="house" defaultValue="manheim">
              {Object.entries(HOUSE_FEES).map(([value, cfg]) => (
                <option key={value} value={value}>
                  {cfg.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="runNumber">Run #</Label>
            <Input id="runNumber" name="runNumber" placeholder="—" />
          </div>
          <div>
            <Label htmlFor="year">Year</Label>
            <Input id="year" name="year" type="number" placeholder="2021" />
          </div>
          <div>
            <Label htmlFor="title">Title</Label>
            <Select id="title" name="title" defaultValue="clean">
              {titleStatusValues.map((t) => (
                <option key={t} value={t}>
                  {TITLE_LABEL[t]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="make">Make</Label>
            <Input id="make" name="make" required placeholder="Ford" />
          </div>
          <div>
            <Label htmlFor="model">Model</Label>
            <Input id="model" name="model" required placeholder="F-150" />
          </div>
          <div>
            <Label htmlFor="trim">Trim</Label>
            <Input id="trim" name="trim" placeholder="XLT" />
          </div>
          <div>
            <Label htmlFor="miles">Miles</Label>
            <Input id="miles" name="miles" type="number" placeholder="65000" />
          </div>
          <div className="col-span-2">
            <Label htmlFor="vin">VIN</Label>
            <Input id="vin" name="vin" placeholder="17 characters" />
          </div>
          <div>
            <Label htmlFor="retailDollars">Retail</Label>
            <Input id="retailDollars" name="retailDollars" type="number" step="0.01" placeholder="24995" />
          </div>
          <div>
            <Label htmlFor="wholesaleDollars">Wholesale</Label>
            <Input id="wholesaleDollars" name="wholesaleDollars" type="number" step="0.01" placeholder="19500" />
          </div>
          <div>
            <Label htmlFor="reconDollars">Recon estimate</Label>
            <Input id="reconDollars" name="reconDollars" type="number" step="0.01" placeholder="500" />
          </div>
          <div className="col-span-2">
            <Label htmlFor="announcements">Announcements</Label>
            <Input id="announcements" name="announcements" placeholder="Frame, TMU, as-is, red light…" />
          </div>
          <Button type="submit" className="col-span-2 mt-1 self-end" disabled={isPending}>
            {isPending ? "Adding…" : "Add to watch-list"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
