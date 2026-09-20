"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { updatePricingAssumptions } from "@/app/sourcing/watch-list/actions";

export function PricingAssumptionsBar({
  targetGrossCents,
  assumedDownCents,
  holdingPerDayCents,
}: {
  targetGrossCents: number;
  assumedDownCents: number;
  holdingPerDayCents: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState({
    targetGrossDollars: String(targetGrossCents / 100),
    assumedDownDollars: String(assumedDownCents / 100),
    holdingCostPerDayDollars: String(holdingPerDayCents / 100),
  });

  function save() {
    const fd = new FormData();
    fd.set("targetGrossDollars", values.targetGrossDollars);
    fd.set("assumedDownDollars", values.assumedDownDollars);
    fd.set("holdingCostPerDayDollars", values.holdingCostPerDayDollars);
    startTransition(() => updatePricingAssumptions(fd));
  }

  function field(key: keyof typeof values, label: string) {
    return (
      <div>
        <Label>{label}</Label>
        <div className="flex items-center gap-1.5 rounded-[var(--radius-panel)] border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-2 transition-[border-color,box-shadow] duration-150 focus-within:border-[var(--color-primary)] focus-within:ring-4 focus-within:ring-[var(--color-primary)]/10">
          <span className="text-[13.5px] text-[var(--color-text-muted)]">$</span>
          <input
            type="number"
            min={0}
            step="1"
            value={values[key]}
            onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
            onBlur={save}
            className="w-full bg-transparent text-[13.5px] text-[var(--color-text)] outline-none"
          />
        </div>
      </div>
    );
  }

  return (
    <Card className="mb-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
          {field("targetGrossDollars", "Target gross per unit")}
          {field("assumedDownDollars", "Down payment assumed")}
          {field("holdingCostPerDayDollars", "Holding cost per day")}
        </div>
        <div className="max-w-xs">
          <div className="text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">On every unit</div>
          <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--color-text-muted)]">
            Buy fee by house, recon, tow, and average turn time hold the max bid down for every unit priced below.
            {isPending && " Saving…"}
          </p>
        </div>
      </div>
    </Card>
  );
}
