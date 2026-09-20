import { cn } from "@/lib/utils";

// Mirrors the credit-grade badge's neighbor in the design (Deal Desk
// v2.dc.html ~line 1435): a small pill with a bank/landmark glyph, green
// once income is verified from an AI-read TurboPass or bank statement,
// gray otherwise. `incomeSource` comes from getUnderwritingSnapshot()
// (lib/deal-underwriting.ts) — non-null only when extraction on one of
// those two document types actually succeeded; a self-reported credit
// app doesn't count, matching the prototype's incomeReport() (tpAI/bsAI
// only). There's no income-verification modal yet (that needs AI
// extraction, same as elsewhere), so this links down to Documents where
// the TurboPass/bank statement gets uploaded.
export function IncomeReportBadge({ incomeSource }: { incomeSource: string | null }) {
  const verified = incomeSource === "TurboPass" || !!incomeSource?.startsWith("Bank statement");

  return (
    <a
      href="#documents"
      title={verified ? `Income verified — ${incomeSource}` : "Income not verified — upload a TurboPass or bank statements"}
      className={cn(
        "flex h-5 w-5 flex-none items-center justify-center rounded-full",
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
    </a>
  );
}
