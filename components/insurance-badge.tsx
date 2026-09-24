"use client";

import { useMemo, useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { DocumentRow } from "@/components/document-row";
import { analyzeDocument, deleteDocument, updateLienholder, uploadDocument } from "@/app/desk/deals/actions";
import { EXTRACTION_SCHEMAS } from "@/lib/extraction-schemas";
import { verifyInsurance, findMatchingLender, type InsuranceStatus } from "@/lib/insurance-verification";
import { cn } from "@/lib/utils";

interface InsuranceDoc {
  id: string;
  category: string;
  fileName: string;
  extractionStatus: string;
  extractedData: unknown;
  extractionError: string | null;
}

interface LenderForMatch {
  id: string;
  name: string;
  address: string | null;
  maxDeductibleCents: number;
}

export interface InsuranceBadgeProps {
  dealId: string;
  customerName: string;
  lienholderName: string | null;
  vehicleVin: string | null;
  lenders: LenderForMatch[];
  documents: InsuranceDoc[];
}

const STATUS_STYLE: Record<InsuranceStatus, string> = {
  unverified: "bg-[var(--color-fill-subtle)] text-[var(--color-text-placeholder)]",
  verified: "bg-[var(--color-positive-bg)] text-[var(--color-positive-text)]",
  issues: "bg-[var(--color-negative-bg)] text-[var(--color-negative-text)]",
};

const STATUS_LABEL: Record<InsuranceStatus, string> = {
  unverified: "Not verified",
  verified: "Verified",
  issues: "Issues found",
};

// Mirrors the credit-grade/income badges next to it: a small pill that
// turns green once an uploaded declaration page checks out against this
// deal (lienholder name + address, deductible limit, primary driver, VIN)
// and red the moment any of those don't match — see
// lib/insurance-verification.ts for exactly what's checked and why.
export function InsuranceBadge({ dealId, customerName, lienholderName, vehicleVin, lenders, documents }: InsuranceBadgeProps) {
  const [isPending, startTransition] = useTransition();
  const [lienholderDraft, setLienholderDraft] = useState(lienholderName ?? "");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const result = useMemo(() => {
    const latestDoc = [...documents].reverse().find((d) => d.category === "insurance" && d.extractionStatus === "success");
    if (!latestDoc) return { status: "unverified" as InsuranceStatus, issues: [] };
    const parsed = EXTRACTION_SCHEMAS.insurance.safeParse(latestDoc.extractedData);
    if (!parsed.success) return { status: "unverified" as InsuranceStatus, issues: [] };
    const matchedLender = findMatchingLender(lienholderName, lenders);
    return verifyInsurance({
      extracted: parsed.data,
      customerName,
      lienholderNameOnFile: lienholderName,
      vehicleVin,
      matchedLender,
    });
  }, [documents, lienholderName, lenders, customerName, vehicleVin]);

  function upload(formData: FormData) {
    setUploadError(null);
    startTransition(async () => {
      const result = await uploadDocument(dealId, formData);
      if (!result.ok) setUploadError(result.error ?? "Upload failed — try again.");
    });
  }

  function saveLienholder(formData: FormData) {
    const name = String(formData.get("lienholderName") ?? "");
    startTransition(() => updateLienholder(dealId, name));
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          title={
            result.status === "verified"
              ? "Insurance verified"
              : result.status === "issues"
                ? "Insurance issues found — click for details"
                : "Insurance not verified — upload the declarations page"
          }
          className={cn(
            "relative flex h-5 w-5 flex-none items-center justify-center rounded-full transition-transform after:absolute after:-inset-1 after:content-[''] active:scale-90",
            STATUS_STYLE[result.status],
          )}
        >
          <ShieldCheck size={12} />
        </button>
      </DialogTrigger>
      <DialogContent title={customerName} subtitle="insurance verification" className="max-w-3xl">
        <div className="rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] p-4">
          <div
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[.03em]",
              STATUS_STYLE[result.status],
            )}
          >
            {STATUS_LABEL[result.status]}
          </div>
          {result.issues.length > 0 && (
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {result.issues.map((issue) => (
                <li key={issue.code} className="flex gap-1.5 text-[12.5px] text-[var(--color-negative-text)]">
                  <span>•</span>
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          )}
          {result.status === "unverified" && documents.some((d) => d.category === "insurance") && (
            <p className="mt-1.5 text-[12px] text-[var(--color-text-muted)]">Analyze the declaration page below with AI to check it.</p>
          )}
        </div>

        <form action={saveLienholder} className="mt-4 flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor={`lienholder-${dealId}`}>Lienholder on this deal</Label>
            <Input
              id={`lienholder-${dealId}`}
              name="lienholderName"
              value={lienholderDraft}
              onChange={(e) => setLienholderDraft(e.target.value)}
              placeholder="Matched against Lenders by name"
            />
          </div>
          <Button type="submit" variant="secondary" disabled={isPending}>
            Save
          </Button>
        </form>

        <div className="mt-4">
          <p className="mb-2 text-[11px] text-[var(--color-text-muted)]">
            Upload the insurance declarations page below. &ldquo;Analyze with AI&rdquo; then checks the lienholder name and
            address, comprehensive/collision deductibles, that {customerName || "the customer"} is listed as a driver, and
            that the vehicle being financed is on the policy by VIN — all against what&rsquo;s on file for this deal.
          </p>

          {documents.length > 0 && (
            <div className="mb-3 flex flex-col">
              {documents.map((doc) => (
                <DocumentRow key={doc.id} document={doc} onAnalyze={analyzeDocument.bind(null, dealId)} onDelete={deleteDocument.bind(null, dealId)} />
              ))}
            </div>
          )}

          <form action={upload} className="flex items-end gap-2">
            <input type="hidden" name="category" value="insurance" />
            <input
              name="file"
              type="file"
              required
              className="block flex-1 text-[12.5px] text-[var(--color-text-muted)] file:mr-3 file:rounded-[var(--radius-pill)] file:border-0 file:bg-[var(--color-fill-subtle)] file:px-3 file:py-1.5 file:text-[12px] file:font-semibold"
            />
            <Button type="submit" variant="secondary" disabled={isPending}>
              {isPending ? "Uploading & analyzing…" : "Upload"}
            </Button>
          </form>
          {uploadError && <p className="mt-1.5 text-[12px] text-[var(--color-negative-text)]">{uploadError}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
