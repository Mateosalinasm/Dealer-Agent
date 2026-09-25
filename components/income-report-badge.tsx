"use client";

import { useMemo } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { DocumentRow } from "@/components/document-row";
import { DocumentUploadPill } from "@/components/document-upload-pill";
import { TurboPassBreakdown } from "@/components/turbopass-breakdown";
import { BankStatementBreakdown } from "@/components/bank-statement-breakdown";
import { analyzeDocument, deleteDocument } from "@/app/desk/deals/actions";
import { EXTRACTION_SCHEMAS } from "@/lib/extraction-schemas";
import { analyzeTurboPass } from "@/lib/turbopass-analysis";
import { analyzeBankStatements } from "@/lib/bank-statement-analysis";
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

  // Every successful bank_statement extraction (several months, uploaded
  // together or across separate visits), cross-referenced into one
  // baseline — see lib/bank-statement-analysis.ts.
  const bankStatementAnalysis = useMemo(() => {
    const successful = documents
      .filter((d) => d.category === "bank_statement" && d.extractionStatus === "success")
      .map((d) => EXTRACTION_SCHEMAS.bank_statement.safeParse(d.extractedData))
      .filter((p): p is { success: true; data: (typeof EXTRACTION_SCHEMAS)["bank_statement"]["_output"] } => p.success)
      .map((p) => p.data);
    if (successful.length === 0) return null;
    return analyzeBankStatements(successful);
  }, [documents]);

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
      <DialogContent
        title={customerName}
        subtitle="income verification"
        className="max-w-3xl"
        headerExtra={
          <div className="flex items-center gap-2">
            <DocumentUploadPill dealId={dealId} category="turbopass" label="TurboPass" />
            <DocumentUploadPill dealId={dealId} category="bank_statement" label="Bank statements" multiple />
          </div>
        }
      >
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
        {bankStatementAnalysis && <BankStatementBreakdown dealId={dealId} analysis={bankStatementAnalysis} />}

        {documents.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[11px] text-[var(--color-text-muted)]">
              Each upload above is analyzed automatically, no separate step needed. Bank statements accept several
              files at once (e.g. the last 3 months) and are cross-referenced into one combined baseline above.
              Stated/verified income can still be entered by hand in Customer.
            </p>
            <div className="flex flex-col">
              {documents.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  document={doc}
                  onAnalyze={analyzeDocument.bind(null, dealId)}
                  onDelete={deleteDocument.bind(null, dealId)}
                />
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
