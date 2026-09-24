"use client";

import { useMemo, useState, useTransition } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { DocumentRow } from "@/components/document-row";
import { TurboPassBreakdown } from "@/components/turbopass-breakdown";
import { analyzeDocument, deleteDocument, uploadDocument } from "@/app/desk/deals/actions";
import { EXTRACTION_SCHEMAS } from "@/lib/extraction-schemas";
import { analyzeTurboPass } from "@/lib/turbopass-analysis";
import { formatCents, cn } from "@/lib/utils";

interface IncomeDoc {
  id: string;
  category: string;
  fileName: string;
  extractionStatus: string;
  extractedData: unknown;
  extractionError: string | null;
}

export interface IncomeReportBadgeProps {
  dealId: string;
  customerName: string;
  incomeSource: string | null;
  monthlyIncomeCents: number | null;
  documents: IncomeDoc[];
}

// Mirrors the credit-grade badge's neighbor in the design (Deal Desk
// v2.dc.html ~line 1435): a small pill with a bank/landmark glyph, green
// once income is verified from an AI-read TurboPass or bank statement,
// gray otherwise. Clicking it opens income verification — upload a
// TurboPass or bank statement here; "Analyze with AI" reads it once
// ANTHROPIC_API_KEY is configured (same as every other document type).
export function IncomeReportBadge({ dealId, customerName, incomeSource, monthlyIncomeCents, documents }: IncomeReportBadgeProps) {
  const verified = incomeSource === "TurboPass" || !!incomeSource?.startsWith("Bank statement");
  const [isPending, startTransition] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Most-recently-extracted TurboPass doc drives the rich breakdown below
  // the summary card — parsed defensively, same as everywhere else this
  // schema is read, so a still-old-shaped or failed extraction just omits
  // the breakdown instead of crashing the modal.
  const turbopassAnalysis = useMemo(() => {
    const turbopassDoc = [...documents].reverse().find((d) => d.category === "turbopass" && d.extractionStatus === "success");
    if (!turbopassDoc) return null;
    const parsed = EXTRACTION_SCHEMAS.turbopass.safeParse(turbopassDoc.extractedData);
    if (!parsed.success || parsed.data.transactions.length === 0) return null;
    return analyzeTurboPass(parsed.data);
  }, [documents]);

  // A bound server-action reference passed directly as a form's `action`
  // triggers Next's full action/navigation machinery, which can fight with
  // the Dialog staying open across the resulting revalidation. Routing the
  // upload through startTransition (same pattern as the credit-grade
  // modal's main form) keeps the Dialog mounted cleanly.
  function upload(formData: FormData) {
    setUploadError(null);
    startTransition(async () => {
      const result = await uploadDocument(dealId, formData);
      if (!result.ok) setUploadError(result.error ?? "Upload failed — try again.");
    });
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          title={verified ? `Income verified — ${incomeSource}` : "Income not verified — upload a TurboPass or bank statements"}
          className={cn(
            "relative flex h-5 w-5 flex-none items-center justify-center rounded-full transition-transform after:absolute after:-inset-1 after:content-[''] active:scale-90",
            verified ? "bg-[var(--color-positive-bg)] text-[var(--color-positive-text)]" : "bg-[var(--color-fill-subtle)] text-[var(--color-text-placeholder)]",
          )}
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M3 10 12 4l9 6" />
            <path d="M5 10v9" />
            <path d="M19 10v9" />
            <path d="M9.5 19v-5" />
            <path d="M14.5 19v-5" />
            <path d="M3 21h18" />
          </svg>
        </button>
      </DialogTrigger>
      <DialogContent title={customerName} subtitle="income verification" className="max-w-3xl">
        <div className="rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] p-4">
          <div
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[.03em]",
              verified ? "bg-[var(--color-positive-bg)] text-[var(--color-positive-text)]" : "bg-[var(--color-caution-bg)] text-[var(--color-caution-text)]",
            )}
          >
            {verified ? "Verified" : "Not verified"}
          </div>
          <div className="mt-2 text-[14px] font-semibold text-[var(--color-text)]">
            {monthlyIncomeCents != null ? `${formatCents(monthlyIncomeCents)}/mo` : "No income figure yet"}
          </div>
          {incomeSource && <div className="text-[11.5px] text-[var(--color-text-muted)]">Source: {incomeSource}</div>}
        </div>

        {turbopassAnalysis && <TurboPassBreakdown dealId={dealId} analysis={turbopassAnalysis} />}

        <div className="mt-4">
          <p className="mb-2 text-[11px] text-[var(--color-text-muted)]">
            Upload a TurboPass or a bank statement below. &ldquo;Analyze with AI&rdquo; reads the recurring
            deposits off it once ANTHROPIC_API_KEY is configured — until then it&apos;ll upload and store the file,
            but income stays unverified. Stated/verified income can still be entered by hand in Customer.
          </p>

          {documents.length > 0 && (
            <div className="mb-3 flex flex-col">
              {documents.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  document={doc}
                  onAnalyze={analyzeDocument.bind(null, dealId)}
                  onDelete={deleteDocument.bind(null, dealId)}
                />
              ))}
            </div>
          )}

          <form action={upload} className="flex items-end gap-2">
            <div className="w-40">
              <Label>Type</Label>
              <Select name="category" defaultValue="turbopass">
                <option value="turbopass">TurboPass</option>
                <option value="bank_statement">Bank statement</option>
              </Select>
            </div>
            <input
              name="file"
              type="file"
              required
              className="block flex-1 text-[12.5px] text-[var(--color-text-muted)] file:mr-3 file:rounded-[var(--radius-pill)] file:border-0 file:bg-[var(--color-fill-subtle)] file:px-3 file:py-1.5 file:text-[12px] file:font-semibold"
            />
            <Button type="submit" variant="secondary" disabled={isPending}>
              {isPending ? "Uploading…" : "Upload"}
            </Button>
          </form>
          {uploadError && <p className="mt-1.5 text-[12px] text-[var(--color-negative-text)]">{uploadError}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
