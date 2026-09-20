"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateCredit } from "@/app/desk/deals/actions";
import { gradeCredit, type CreditFacts } from "@/lib/credit-grade";
import { cn } from "@/lib/utils";

const GRADE_TONE: Record<string, string> = {
  "A+": "bg-[var(--color-positive-bg)] text-[var(--color-positive-text)]",
  A: "bg-[var(--color-positive-bg)] text-[var(--color-positive-text)]",
  B: "bg-[var(--color-info-bg)] text-[var(--color-info-text)]",
  C: "bg-[var(--color-caution-bg)] text-[var(--color-caution-text)]",
  D: "bg-[var(--color-caution-bg)] text-[var(--color-caution-text)]",
  F: "bg-[var(--color-negative-bg)] text-[var(--color-negative-text)]",
};

export interface CreditGradeBadgeProps {
  dealId: string;
  customerName: string;
  vehicleLabel: string;
  facts: CreditFacts;
}

export function CreditGradeBadge({ dealId, customerName, vehicleLabel, facts }: CreditGradeBadgeProps) {
  const [fields, setFields] = useState(facts);
  const [, startTransition] = useTransition();
  const result = gradeCredit(fields);
  const hasScore = !!facts.fico;

  function set<K extends keyof CreditFacts>(key: K, value: CreditFacts[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function save(formData: FormData) {
    startTransition(() => updateCredit(dealId, formData));
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-5 min-w-5 flex-none items-center justify-center rounded-full px-1 text-[10.5px] font-bold",
            hasScore ? GRADE_TONE[result.grade] : "bg-[var(--color-fill-subtle)] text-[var(--color-text-placeholder)]",
          )}
          title="Credit grade"
        >
          {hasScore ? result.grade : "?"}
        </button>
      </DialogTrigger>
      <DialogContent title={customerName} subtitle={`${vehicleLabel || "Vehicle TBD"} · credit grade`}>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <form action={save} className="flex flex-col gap-3">
            <div>
              <div className="mb-1.5 text-[13.5px] font-semibold text-[var(--color-text)]">Credit report</div>
              <p className="text-[11.5px] text-[var(--color-text-muted)]">Type the numbers in yourself for now — document upload comes later.</p>
            </div>
            <div>
              <Label>Identification</Label>
              <Select name="idType" defaultValue="US ID">
                <option value="US ID">US ID</option>
                <option value="ITIN">ITIN</option>
                <option value="Foreign passport">Foreign passport</option>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>FICO score</Label>
                <Input name="fico" type="number" value={fields.fico ?? ""} onChange={(e) => set("fico", e.target.value ? Number(e.target.value) : null)} placeholder="640" />
              </div>
              <div>
                <Label>Inquiries (30 days)</Label>
                <Input
                  name="inquiries30d"
                  type="number"
                  value={fields.inquiries30d ?? ""}
                  onChange={(e) => set("inquiries30d", e.target.value ? Number(e.target.value) : null)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Repossessions</Label>
                <Input
                  name="repossessions"
                  type="number"
                  value={fields.repossessions ?? ""}
                  onChange={(e) => set("repossessions", e.target.value ? Number(e.target.value) : null)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Collections ($)</Label>
                <Input
                  name="collectionsDollars"
                  type="number"
                  step="0.01"
                  value={fields.collectionsAmount != null ? fields.collectionsAmount / 100 : ""}
                  onChange={(e) => set("collectionsAmount", e.target.value ? Math.round(Number(e.target.value) * 100) : null)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Open autos</Label>
                <Input
                  name="openAutos"
                  type="number"
                  value={fields.openAutos ?? ""}
                  onChange={(e) => set("openAutos", e.target.value ? Number(e.target.value) : null)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Auto lates</Label>
                <Input
                  name="autoLates"
                  type="number"
                  value={fields.autoLates ?? ""}
                  onChange={(e) => set("autoLates", e.target.value ? Number(e.target.value) : null)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Bankruptcies</Label>
                <Input
                  name="bankruptcies"
                  type="number"
                  value={fields.bankruptcies ?? ""}
                  onChange={(e) => set("bankruptcies", e.target.value ? Number(e.target.value) : null)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Mortgages</Label>
                <Input
                  name="mortgages"
                  type="number"
                  value={fields.mortgages ?? ""}
                  onChange={(e) => set("mortgages", e.target.value ? Number(e.target.value) : null)}
                  placeholder="0"
                />
              </div>
            </div>
            <Button type="submit" className="self-end">
              Save
            </Button>
          </form>

          <div className="rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] p-4">
            <div className="flex items-center gap-3">
              <div className={cn("flex h-11 w-11 flex-none items-center justify-center rounded-[var(--radius-panel)] text-[17px] font-bold", GRADE_TONE[result.grade])}>
                {fields.fico ? result.grade : "?"}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold text-[var(--color-text)]">{customerName}</div>
                <div className="truncate text-[11.5px] text-[var(--color-text-muted)]">{vehicleLabel || "Vehicle TBD"}</div>
              </div>
            </div>
            <div className="mt-3 text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">How it got there</div>
            <div className="mt-1.5 flex flex-col gap-1.5">
              {result.reasons.map((r, i) => (
                <div key={i} className="flex items-baseline justify-between gap-2 text-[12px]">
                  <span className="font-semibold text-[var(--color-text)]">{r.label}</span>
                  <span className="text-right text-[var(--color-text-muted)]">{r.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
