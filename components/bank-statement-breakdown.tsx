"use client";

import { useMemo, useState, useTransition } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/utils";
import { setVerifiedIncome } from "@/app/desk/deals/actions";
import type { BankStatementAnalysis } from "@/lib/bank-statement-analysis";

// Same shape/pattern as TurboPassBreakdown: a checkable list of recurring
// items feeding one baseline figure, with "Use this total" writing it to
// deals.verifiedIncome. Shown once 2+ bank statements for this deal have
// been AI-analyzed — lib/bank-statement-analysis.ts does the cross-
// statement grouping/summing, never the AI itself.
export function BankStatementBreakdown({ dealId, analysis }: { dealId: string; analysis: BankStatementAnalysis }) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(analysis.recurringDeposits.map((g) => [g.description, true])),
  );

  const totalCents = useMemo(
    () => analysis.recurringDeposits.reduce((sum, g) => sum + (checked[g.description] ? g.monthlyAverageCents : 0), 0),
    [analysis, checked],
  );

  function toggle(description: string) {
    setChecked((prev) => ({ ...prev, [description]: !prev[description] }));
    setSaved(false);
  }

  function useThisTotal() {
    startTransition(async () => {
      await setVerifiedIncome(dealId, totalCents);
      setSaved(true);
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--color-text-muted)]">
        <span className="font-semibold text-[var(--color-text)]">{analysis.statementCount} statements</span>
        <span>·</span>
        <span>{analysis.monthsSpanned} month{analysis.monthsSpanned === 1 ? "" : "s"} spanned</span>
        {analysis.totalOverdraftCount > 0 && (
          <>
            <span>·</span>
            <span className="text-[var(--color-negative-text)]">
              {analysis.totalOverdraftCount} overdraft{analysis.totalOverdraftCount === 1 ? "" : "s"} across all statements
            </span>
          </>
        )}
      </div>

      {analysis.holderNameMismatch && (
        <div className="flex items-center gap-2 rounded-[var(--radius-panel)] bg-[var(--color-caution-bg)] px-3 py-2 text-[11.5px] font-medium text-[var(--color-caution-text)]">
          <TriangleAlert size={14} className="flex-none" />
          These statements name different account holders ({analysis.accountHolderNames.join(", ")}) — double check they&apos;re
          all for the same customer before using this baseline.
        </div>
      )}

      {analysis.recurringDeposits.length > 0 && (
        <div className="rounded-[var(--radius-panel)] border border-[var(--color-hairline)] p-3">
          <div className="mb-0.5 text-[13px] font-semibold text-[var(--color-text)]">Recurring deposits across all statements</div>
          <p className="mb-2 text-[11px] text-[var(--color-text-muted)]">
            Matched by description across every statement uploaded for this deal. Switch off anything that doesn&apos;t
            look like real recurring income.
          </p>
          <div className="flex flex-col gap-1.5">
            {analysis.recurringDeposits.map((g) => (
              <label
                key={g.description}
                className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-panel)] px-2.5 py-2 hover:bg-[var(--color-fill-subtle)]"
              >
                <input
                  type="checkbox"
                  checked={!!checked[g.description]}
                  onChange={() => toggle(g.description)}
                  className="h-4 w-4 flex-none rounded accent-[var(--color-primary)]"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold text-[var(--color-text)]">{g.description}</div>
                  <div className="truncate text-[11px] text-[var(--color-text-muted)]">
                    Seen in {g.statementsSeenIn} of {analysis.statementCount} statement{analysis.statementCount === 1 ? "" : "s"} · {g.occurrences} deposit
                    {g.occurrences === 1 ? "" : "s"} · {formatCents(g.totalCents)} total
                  </div>
                </div>
                <div className="flex-none tabular-nums text-[13px] font-semibold text-[var(--color-text)]">{formatCents(g.monthlyAverageCents)}/mo</div>
              </label>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-[var(--color-hairline)] pt-3">
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">Combined baseline</div>
              <div className="text-[19px] font-semibold tabular-nums text-[var(--color-text)]">{formatCents(totalCents)}/mo</div>
            </div>
            <Button type="button" variant="secondary" disabled={pending} onClick={useThisTotal}>
              {pending ? "Saving…" : saved ? "Saved as verified income" : "Use this total"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
