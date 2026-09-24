"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/utils";
import { EXTRACTION_SCHEMAS, isExtractable, type ExtractableCategory } from "@/lib/extraction-schemas";
import { analyzeTurboPass } from "@/lib/turbopass-analysis";

const CATEGORY_LABEL: Record<string, string> = {
  turbopass: "TurboPass",
  bank_statement: "Bank statement",
  credit_report: "Credit report",
  credit_app: "Credit app",
  insurance: "Insurance",
  autocheck: "AutoCheck",
  lender_guidelines: "Guidelines",
  other: "Other",
};

interface DocumentRowProps {
  document: {
    id: string;
    category: string;
    fileName: string;
    extractionStatus: string;
    extractedData: unknown;
    extractionError: string | null;
  };
  onAnalyze?: (documentId: string) => Promise<void>;
  onDelete: (documentId: string) => Promise<void>;
}

// Scope-agnostic: the deal/vehicle/lender detail views each pass their own
// bound analyze/delete server actions, so this component doesn't need to
// know which owner column a document belongs to.
export function DocumentRow({ document: doc, onAnalyze, onDelete }: DocumentRowProps) {
  const [isPending, startTransition] = useTransition();

  const extractable = onAnalyze && isExtractable(doc.category);
  const showAnalyzing = isPending || doc.extractionStatus === "pending";

  return (
    <div className="border-b border-[var(--color-hairline)] py-2.5 last:border-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Badge tone="info">{CATEGORY_LABEL[doc.category] ?? doc.category}</Badge>
          <a
            href={`/api/documents/${doc.id}/file`}
            target="_blank"
            rel="noreferrer"
            className="text-[12.5px] font-medium text-[var(--color-primary)] hover:underline"
          >
            {doc.fileName}
          </a>
          {doc.extractionStatus === "success" && <Badge tone="positive">Read</Badge>}
          {doc.extractionStatus === "failed" && <Badge tone="negative">Couldn&apos;t read</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {extractable && (
            <Button
              type="button"
              variant="secondary"
              disabled={showAnalyzing}
              className="px-2 py-1 text-[11px]"
              onClick={() => startTransition(() => onAnalyze(doc.id))}
            >
              {showAnalyzing
                ? "Analyzing…"
                : doc.extractionStatus === "success"
                  ? "Re-analyze"
                  : "Analyze with AI"}
            </Button>
          )}
          <Button
            type="button"
            variant="destructive"
            className="px-2 py-1 text-[11px]"
            disabled={isPending}
            onClick={() => startTransition(() => onDelete(doc.id))}
          >
            Remove
          </Button>
        </div>
      </div>

      {doc.extractionStatus === "failed" && doc.extractionError && (
        <p className="mt-1.5 text-[11.5px] text-[var(--color-negative-text)]">{doc.extractionError}</p>
      )}

      {doc.extractionStatus === "success" && isExtractable(doc.category) && (
        <ExtractedSummary category={doc.category} data={doc.extractedData} />
      )}
    </div>
  );
}

function ExtractedSummary({ category, data }: { category: ExtractableCategory; data: unknown }) {
  const parsed = EXTRACTION_SCHEMAS[category].safeParse(data);
  if (!parsed.success) {
    return (
      <p className="mt-1.5 text-[11.5px] text-[var(--color-text-muted)]">
        Extracted, but the stored data didn&apos;t match the expected shape.
      </p>
    );
  }

  const row = (label: string, value: React.ReactNode, key?: string) => (
    <div key={key ?? label} className="flex items-center justify-between py-0.5">
      <span className="text-[11.5px] text-[var(--color-text-muted)]">{label}</span>
      <span className="tabular-nums text-[11.5px] font-medium text-[var(--color-text)]">{value ?? "—"}</span>
    </div>
  );

  if (category === "turbopass") {
    const d = parsed.data as (typeof EXTRACTION_SCHEMAS)["turbopass"]["_output"];
    const holderNames = d.holders.map((h) => h.name).filter((n): n is string => !!n);
    // The deterministic combined baseline is the trustworthy figure once
    // there's a transaction list to compute it from — see
    // lib/deal-underwriting.ts for why the model's own totalMonthlyIncomeCents
    // is only a fallback, not the primary source.
    const monthlyIncomeCents = d.transactions.length > 0 ? analyzeTurboPass(d).combinedBaselineCents : d.totalMonthlyIncomeCents;
    return (
      <div className="mt-2 rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] p-3">
        {row("Applicant", d.applicantName)}
        {row("Total monthly income", monthlyIncomeCents != null ? formatCents(monthlyIncomeCents) : null)}
        {holderNames.length > 0 && row("Holders", holderNames.join(", "))}
        {row("Accounts", d.accounts.length || null)}
        {row("Transactions", d.transactions.length || null)}
        {d.notes && <p className="mt-1.5 text-[11px] italic text-[var(--color-text-muted)]">{d.notes}</p>}
        <p className="mt-1.5 text-[10.5px] text-[var(--color-text-placeholder)]">Full categorized breakdown is above, in the income verification card.</p>
      </div>
    );
  }

  if (category === "bank_statement") {
    const d = parsed.data as (typeof EXTRACTION_SCHEMAS)["bank_statement"]["_output"];
    return (
      <div className="mt-2 rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] p-3">
        {row("Account holder", d.accountHolderName)}
        {row("Period", d.statementPeriodStart && d.statementPeriodEnd ? `${d.statementPeriodStart} – ${d.statementPeriodEnd}` : null)}
        {row("Ending balance", d.endingBalanceCents != null ? formatCents(d.endingBalanceCents) : null)}
        {row("Avg. daily balance", d.averageDailyBalanceCents != null ? formatCents(d.averageDailyBalanceCents) : null)}
        {row("Overdrafts", d.overdraftCount)}
        {d.recurringDeposits.length > 0 && (
          <div className="mt-1.5">
            <div className="text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
              Recurring deposits
            </div>
            {d.recurringDeposits.map((s, i) => (
              <div key={i} className="flex items-center justify-between py-0.5">
                <span className="text-[11.5px] text-[var(--color-text)]">
                  {s.description ?? "Unknown"} {s.frequency ? `· ${s.frequency}` : ""}
                </span>
                <span className="tabular-nums text-[11.5px] font-medium">
                  {s.amountCents != null ? formatCents(s.amountCents) : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
        {d.notes && <p className="mt-1.5 text-[11px] italic text-[var(--color-text-muted)]">{d.notes}</p>}
      </div>
    );
  }

  if (category === "credit_report") {
    const d = parsed.data as (typeof EXTRACTION_SCHEMAS)["credit_report"]["_output"];
    return (
      <div className="mt-2 rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] p-3">
        {row("Applicant", d.applicantName)}
        {d.scores.map((s, i) => row(s.bureau ?? "Score", s.score, `score-${i}`))}
        {row("Open tradelines", d.openTradelines)}
        {row("Open auto loans", d.openAutoLoans)}
        {row("Monthly debt payments", d.totalMonthlyDebtPaymentsCents != null ? formatCents(d.totalMonthlyDebtPaymentsCents) : null)}
        {row("Inquiries (6mo)", d.inquiriesLast6Months)}
        <div className="mt-1.5">
          <div className="text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
            Derogatory
          </div>
          {row("Bankruptcies", d.derogatory.bankruptcies)}
          {row("Collections", d.derogatory.collections)}
          {row("Repossessions", d.derogatory.repossessions)}
          {row("30+ day lates", d.derogatory.latePayments30Plus)}
        </div>
        {d.notes && <p className="mt-1.5 text-[11px] italic text-[var(--color-text-muted)]">{d.notes}</p>}
      </div>
    );
  }

  if (category === "credit_app") {
    const d = parsed.data as (typeof EXTRACTION_SCHEMAS)["credit_app"]["_output"];
    return (
      <div className="mt-2 rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] p-3">
        {row("Applicant", d.applicantName)}
        {row("Co-applicant", d.coApplicantName)}
        {row("Employer", d.employer)}
        {row("Job title", d.jobTitle)}
        {row("Stated monthly income", d.monthlyIncomeStatedCents != null ? formatCents(d.monthlyIncomeStatedCents) : null)}
        {row("Years at job", d.yearsAtJob)}
        {row("Residence", d.residenceType)}
        {row("Monthly housing payment", d.monthlyHousingPaymentCents != null ? formatCents(d.monthlyHousingPaymentCents) : null)}
        {d.notes && <p className="mt-1.5 text-[11px] italic text-[var(--color-text-muted)]">{d.notes}</p>}
      </div>
    );
  }

  if (category === "insurance") {
    const d = parsed.data as (typeof EXTRACTION_SCHEMAS)["insurance"]["_output"];
    return (
      <div className="mt-2 rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] p-3">
        {row("Insured", d.insuredName)}
        {row("Policy #", d.policyNumber)}
        {row("Effective", d.effectiveDate)}
        {row("Lienholder", d.lienholder.name)}
        {row("Drivers", d.drivers.length || null)}
        {row("Vehicles covered", d.vehicles.length || null)}
        {d.notes && <p className="mt-1.5 text-[11px] italic text-[var(--color-text-muted)]">{d.notes}</p>}
        <p className="mt-1.5 text-[10.5px] text-[var(--color-text-placeholder)]">Full match results are above, in the insurance verification card.</p>
      </div>
    );
  }

  return null;
}
