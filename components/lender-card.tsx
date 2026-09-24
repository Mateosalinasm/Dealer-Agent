"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { ProgramForm } from "@/components/program-form";
import { LenderGuidelinesUpload } from "@/components/lender-guidelines-upload";
import {
  createProgram,
  deleteLender,
  deleteProgram,
  setLenderActive,
  updateLender,
  updateProgram,
} from "@/app/lenders/actions";

interface ProgramRow {
  id: string;
  label: string;
  advancePct: number;
  maxLtvPct: number | null;
  maxTermMonths: number | null;
  maxMiles: number | null;
  maxAgeYears: number | null;
  acquisitionFee: number;
  minCreditScore: number | null;
  maxPtiPct: number | null;
  typicalAprBps: number | null;
  allowedTitles: string[] | null;
  notes: string | null;
}

interface LenderRow {
  id: string;
  name: string;
  contact: string | null;
  repPhone: string | null;
  address: string | null;
  maxDeductibleCents: number;
  notes: string | null;
  active: boolean;
}

export function LenderCard({ lender, programs, guidelinesDocs }: { lender: LenderRow; programs: ProgramRow[]; guidelinesDocs: { id: string; fileName: string }[] }) {
  const [editingLender, setEditingLender] = useState(false);
  const [addingProgram, setAddingProgram] = useState(false);
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);

  return (
    <Card className="flex h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold text-[var(--color-text)]">{lender.name}</span>
            <Badge tone={lender.active ? "positive" : "neutral"}>{lender.active ? "Active" : "Inactive"}</Badge>
          </div>
          {lender.contact && <div className="mt-1 text-[12px] text-[var(--color-text-muted)]">{lender.contact}</div>}
          {lender.repPhone && (
            <a href={`tel:${lender.repPhone.replace(/[^0-9+]/g, "")}`} className="mt-0.5 block text-[12px] font-medium text-[var(--color-info-text)] hover:underline">
              {lender.repPhone}
            </a>
          )}
          {lender.address && <div className="mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">{lender.address}</div>}
          <div className="mt-0.5 text-[11px] text-[var(--color-text-placeholder)]">Max deductible: ${(lender.maxDeductibleCents / 100).toFixed(0)}</div>
        </div>
        <div className="flex flex-none items-center gap-1.5">
          <form action={setLenderActive.bind(null, lender.id, !lender.active)}>
            <Button type="submit" variant="secondary" className="px-2 py-1 text-[11px]">
              {lender.active ? "Deactivate" : "Activate"}
            </Button>
          </form>
          <Button type="button" variant="secondary" className="px-2 py-1 text-[11px]" onClick={() => setEditingLender((v) => !v)}>
            Edit
          </Button>
          <form action={deleteLender.bind(null, lender.id)}>
            <Button type="submit" variant="destructive" className="px-2 py-1 text-[11px]">
              Delete
            </Button>
          </form>
        </div>
      </div>

      {lender.notes && <div className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">{lender.notes}</div>}

      {editingLender && (
        <form
          action={async (fd) => {
            await updateLender(lender.id, fd);
            setEditingLender(false);
          }}
          className="mt-3 flex flex-col gap-2 rounded-[var(--radius-panel)] border border-[var(--color-hairline)] p-3"
        >
          <div>
            <Label htmlFor={`name-${lender.id}`}>Name</Label>
            <Input id={`name-${lender.id}`} name="name" required defaultValue={lender.name} />
          </div>
          <div>
            <Label htmlFor={`contact-${lender.id}`}>Contact</Label>
            <Input id={`contact-${lender.id}`} name="contact" defaultValue={lender.contact ?? ""} />
          </div>
          <div>
            <Label htmlFor={`rep-phone-${lender.id}`}>Rep phone</Label>
            <Input id={`rep-phone-${lender.id}`} name="repPhone" type="tel" placeholder="(555) 555-0123" defaultValue={lender.repPhone ?? ""} />
          </div>
          <div>
            <Label htmlFor={`address-${lender.id}`}>Address</Label>
            <Input id={`address-${lender.id}`} name="address" placeholder="Where this lender's lien releases/payoffs go" defaultValue={lender.address ?? ""} />
          </div>
          <div>
            <Label htmlFor={`deductible-${lender.id}`}>Max insurance deductible ($)</Label>
            <Input
              id={`deductible-${lender.id}`}
              name="maxDeductibleDollars"
              type="number"
              step="1"
              min={0}
              defaultValue={lender.maxDeductibleCents / 100}
            />
            <p className="mt-1 text-[10.5px] text-[var(--color-text-muted)]">Used by insurance verification — comprehensive/collision deductible can&apos;t exceed this.</p>
          </div>
          <div>
            <Label htmlFor={`lnotes-${lender.id}`}>Notes</Label>
            <Textarea id={`lnotes-${lender.id}`} name="notes" rows={2} defaultValue={lender.notes ?? ""} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditingLender(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {programs.map((p) => (
          <div key={p.id} className="rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] p-3">
            <div className="flex items-center justify-between">
              <div className="text-[13px] font-semibold text-[var(--color-text)]">{p.label}</div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="px-2 py-1 text-[11px]"
                  onClick={() => setEditingProgramId(editingProgramId === p.id ? null : p.id)}
                >
                  {editingProgramId === p.id ? "Close" : "Edit"}
                </Button>
                <form action={deleteProgram.bind(null, p.id)}>
                  <Button type="submit" variant="destructive" className="px-2 py-1 text-[11px]">
                    Delete
                  </Button>
                </form>
              </div>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-[var(--color-text-muted)]">
              <span>{p.advancePct}% advance</span>
              {p.maxLtvPct != null && <span>{p.maxLtvPct}% max LTV</span>}
              {p.maxTermMonths != null && <span>{p.maxTermMonths}mo max term</span>}
              {p.maxMiles != null && <span>{p.maxMiles.toLocaleString()} mi cap</span>}
              {p.maxAgeYears != null && <span>{p.maxAgeYears}yr cap</span>}
              {p.minCreditScore != null && <span>{p.minCreditScore}+ credit</span>}
              {p.maxPtiPct != null && <span>{p.maxPtiPct}% PTI cap</span>}
              {p.typicalAprBps != null && <span>~{(p.typicalAprBps / 100).toFixed(2)}% APR</span>}
              <span>{p.allowedTitles && p.allowedTitles.length > 0 ? p.allowedTitles.join(", ") : "any title"}</span>
            </div>

            {editingProgramId === p.id && (
              <ProgramForm
                action={async (fd) => {
                  await updateProgram(p.id, fd);
                  setEditingProgramId(null);
                }}
                onCancel={() => setEditingProgramId(null)}
                initial={{
                  label: p.label,
                  advancePct: p.advancePct,
                  maxLtvPct: p.maxLtvPct,
                  maxTermMonths: p.maxTermMonths,
                  maxMiles: p.maxMiles,
                  maxAgeYears: p.maxAgeYears,
                  acquisitionFeeDollars: p.acquisitionFee / 100,
                  minCreditScore: p.minCreditScore,
                  maxPtiPct: p.maxPtiPct,
                  typicalAprPct: p.typicalAprBps != null ? p.typicalAprBps / 100 : null,
                  allowedTitles: p.allowedTitles,
                  notes: p.notes,
                }}
              />
            )}
          </div>
        ))}
      </div>

      {addingProgram ? (
        <ProgramForm
          action={async (fd) => {
            await createProgram(lender.id, fd);
            setAddingProgram(false);
          }}
          onCancel={() => setAddingProgram(false)}
        />
      ) : (
        <Button type="button" variant="secondary" className="mt-3" onClick={() => setAddingProgram(true)}>
          Add program
        </Button>
      )}

      <div className="mt-3 border-t border-[var(--color-hairline)] pt-3">
        <LenderGuidelinesUpload lenderId={lender.id} documents={guidelinesDocs} />
      </div>
    </Card>
  );
}
