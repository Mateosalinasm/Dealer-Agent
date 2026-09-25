"use client";

import { useMemo, useState, useTransition } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCents, cn } from "@/lib/utils";
import { setVerifiedIncome } from "@/app/desk/deals/actions";
import type { TurboPassAnalysis } from "@/lib/turbopass-analysis";

const CATEGORY_LABEL: Record<string, string> = {
  payroll: "Payroll",
  zelle: "Zelle",
  internal_transfer: "Internal transfer",
  mobile_deposit: "Mobile deposit",
  cash_deposit: "Cash deposit",
  fee: "Fees",
  card_debit: "Card / debit",
  other: "Other",
};

interface CheckableLine {
  id: string;
  label: string;
  subtitle: string;
  amountCents: number;
}

export function TurboPassBreakdown({ dealId, analysis }: { dealId: string; analysis: TurboPassAnalysis }) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const lines: CheckableLine[] = useMemo(() => {
    const payrollLines = analysis.payrollGroups.map((g) => ({
      id: `payroll:${g.holderName}:${g.employer}`,
      label: g.holderName,
      subtitle: `${g.employer} · ${g.depositCount} deposit${g.depositCount === 1 ? "" : "s"}`,
      amountCents: g.monthlyAverageCents,
    }));
    const unrelatedLine: CheckableLine[] =
      analysis.unrelatedTransfers.count > 0
        ? [
            {
              id: "unrelated-transfers",
              label: "Zelle from outside the household",
              subtitle: analysis.unrelatedTransfers.bySender.map((s) => s.name).join(", "),
              amountCents: analysis.unrelatedTransfers.monthlyAverageCents,
            },
          ]
        : [];
    return [...payrollLines, ...unrelatedLine];
  }, [analysis]);

  const [checked, setChecked] = useState<Record<string, boolean>>(() => Object.fromEntries(lines.map((l) => [l.id, true])));

  const totalCents = lines.reduce((sum, l) => sum + (checked[l.id] ? l.amountCents : 0), 0);

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
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
      {lines.length > 0 && (
        <div className="rounded-[var(--radius-panel)] border border-[var(--color-hairline)] p-3">
          <div className="mb-0.5 text-[13px] font-semibold text-[var(--color-text)]">Income used for this deal</div>
          <p className="mb-2 text-[11px] text-[var(--color-text-muted)]">
            Only the income of whoever is signing can be used. Switch off anything that belongs to someone who is not on the deal.
          </p>
          <div className="flex flex-col gap-1.5">
            {lines.map((l) => (
              <label
                key={l.id}
                className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-panel)] px-2.5 py-2 hover:bg-[var(--color-fill-subtle)]"
              >
                <input type="checkbox" checked={!!checked[l.id]} onChange={() => toggle(l.id)} className="h-4 w-4 flex-none rounded accent-[var(--color-primary)]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold text-[var(--color-text)]">{l.label}</div>
                  <div className="break-words text-[11px] text-[var(--color-text-muted)]">{l.subtitle}</div>
                </div>
                <div className="flex-none self-start tabular-nums text-[13px] font-semibold text-[var(--color-text)]">{formatCents(l.amountCents)}</div>
              </label>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-[var(--color-hairline)] pt-3">
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">Income this deal runs on</div>
              <div className="text-[19px] font-semibold tabular-nums text-[var(--color-text)]">{formatCents(totalCents)}/mo</div>
            </div>
            <Button type="button" variant="secondary" disabled={pending} onClick={useThisTotal}>
              {pending ? "Saving…" : saved ? "Saved as verified income" : "Use this total"}
            </Button>
          </div>
        </div>
      )}

      {analysis.multipleHolders && (
        <div className="flex items-center gap-2 rounded-[var(--radius-panel)] bg-[var(--color-caution-bg)] px-3 py-2 text-[11.5px] font-medium text-[var(--color-caution-text)]">
          <TriangleAlert size={14} className="flex-none" />
          {analysis.holders.length} people are named on this report — double check every payroll line is attributed to the right person.
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {analysis.payrollGroups.map((g) => (
          <div key={`${g.holderName}:${g.employer}`} className="rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] p-3">
            <div className="truncate text-[12.5px] font-semibold text-[var(--color-text)]">{g.holderName}</div>
            <div className="break-words text-[10.5px] text-[var(--color-text-muted)]">{g.employer}</div>
            <div className="mt-1.5 text-[17px] font-semibold tabular-nums text-[var(--color-text)]">{formatCents(g.monthlyAverageCents)}</div>
            <div className="text-[10px] text-[var(--color-text-placeholder)]">monthly payroll baseline</div>
            <div className="mt-2 flex flex-col gap-0.5 border-t border-[var(--color-hairline)] pt-1.5 text-[11px]">
              <div className="flex justify-between text-[var(--color-text-muted)]">
                <span>Deposits</span>
                <span className="tabular-nums font-medium text-[var(--color-text)]">
                  {g.depositCount} · {formatCents(g.totalCents)}
                </span>
              </div>
              {g.accountLast4 && (
                <div className="flex justify-between text-[var(--color-text-muted)]">
                  <span>Into</span>
                  <span className="font-medium text-[var(--color-text)]">Checking …{g.accountLast4}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {analysis.unrelatedTransfers.count > 0 && (
          <div className="rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] p-3">
            <div className="text-[12.5px] font-semibold text-[var(--color-text)]">Unrelated transfers</div>
            <div className="text-[10.5px] text-[var(--color-text-muted)]">Senders with no name match to a holder</div>
            <div className="mt-1.5 text-[17px] font-semibold tabular-nums text-[var(--color-info-text)]">{formatCents(analysis.unrelatedTransfers.monthlyAverageCents)}</div>
            <div className="text-[10px] text-[var(--color-text-placeholder)]">
              separate monthly baseline · {formatCents(analysis.unrelatedTransfers.totalCents)} over {analysis.unrelatedTransfers.count} transfer
              {analysis.unrelatedTransfers.count === 1 ? "" : "s"}
            </div>
            <div className="mt-2 flex flex-col gap-0.5 border-t border-[var(--color-hairline)] pt-1.5 text-[11px]">
              {analysis.unrelatedTransfers.bySender.map((s) => (
                <div key={s.name} className="flex items-center justify-between gap-2 text-[var(--color-text-muted)]">
                  <span className="truncate">
                    {s.name} <span className="tabular-nums">×{s.count}</span>
                  </span>
                  <span className="flex-none tabular-nums font-medium text-[var(--color-text)]">{formatCents(s.totalCents)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {analysis.relatedPartyExcluded.count > 0 && (
          <div className="rounded-[var(--radius-panel)] bg-[var(--color-negative-bg)] p-3">
            <div className="text-[12.5px] font-semibold text-[var(--color-negative-text)]">Related party — excluded</div>
            <div className="text-[10.5px] text-[var(--color-text-muted)]">Same last name or a holder name — not counted in any baseline</div>
            <div className="mt-1.5 text-[17px] font-semibold tabular-nums text-[var(--color-negative-text)]">{formatCents(analysis.relatedPartyExcluded.totalCents)}</div>
            <div className="text-[10px] text-[var(--color-text-placeholder)]">
              {analysis.relatedPartyExcluded.count} transfer{analysis.relatedPartyExcluded.count === 1 ? "" : "s"}
            </div>
            <div className="mt-2 flex flex-col gap-0.5 border-t border-[var(--color-hairline)] pt-1.5 text-[11px]">
              {analysis.relatedPartyExcluded.bySender.map((s) => (
                <div key={s.name} className="flex items-center justify-between gap-2 text-[var(--color-text-muted)]">
                  <span className="truncate">
                    {s.name} <span className="tabular-nums">×{s.count}</span>
                  </span>
                  <span className="flex-none tabular-nums font-medium text-[var(--color-text)]">{formatCents(s.totalCents)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {analysis.accounts.length > 0 && (
        <div>
          <div className="mb-1.5 text-[13px] font-semibold text-[var(--color-text)]">Accounts</div>
          <div className="flex flex-col gap-2">
            {analysis.accounts.map((a) => (
              <div key={a.last4 ?? a.institution} className="rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] p-3">
                <div className="flex items-center justify-between">
                  <div className="text-[12.5px] font-semibold text-[var(--color-text)]">
                    {a.accountType ?? "Account"} {a.last4 ? `…${a.last4}` : ""}
                  </div>
                  <div className="text-[11px] text-[var(--color-text-muted)]">{a.institution}</div>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
                  {a.monthlyDepositsCents != null && (
                    <div className="flex justify-between text-[var(--color-text-muted)]">
                      <span>Monthly deposits</span>
                      <span className="tabular-nums font-medium text-[var(--color-text)]">{formatCents(a.monthlyDepositsCents)}</span>
                    </div>
                  )}
                  {a.avgDailyBalanceCents != null && (
                    <div className="flex justify-between text-[var(--color-text-muted)]">
                      <span>Avg daily balance</span>
                      <span className="tabular-nums font-medium text-[var(--color-text)]">{formatCents(a.avgDailyBalanceCents)}</span>
                    </div>
                  )}
                  {a.nsfCount != null && (
                    <div className="flex justify-between text-[var(--color-text-muted)]">
                      <span>NSF</span>
                      <span className="tabular-nums font-medium text-[var(--color-text)]">{a.nsfCount}</span>
                    </div>
                  )}
                  {a.payrollFor && (
                    <div className="flex justify-between text-[var(--color-text-muted)]">
                      <span>Payroll for</span>
                      <span className="truncate font-medium text-[var(--color-text)]">{a.payrollFor}</span>
                    </div>
                  )}
                </div>
                {a.categories.length > 0 && (
                  <div className="mt-2 flex flex-col gap-0.5 border-t border-[var(--color-hairline)] pt-1.5">
                    {a.categories.map((c) => (
                      <div key={c.category} className="flex items-center justify-between text-[11px]">
                        <span className="text-[var(--color-text-muted)]">
                          {CATEGORY_LABEL[c.category] ?? c.category} <span className="tabular-nums">{c.count} items</span>
                        </span>
                        <span className={cn("tabular-nums font-medium", c.totalCents < 0 ? "text-[var(--color-negative-text)]" : "text-[var(--color-text)]")}>
                          {formatCents(c.totalCents)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis.transactions.length > 0 && (
        <div>
          <div className="mb-1.5 text-[13px] font-semibold text-[var(--color-text)]">Transactions</div>
          <div className="max-h-80 overflow-y-auto rounded-[var(--radius-panel)] border border-[var(--color-hairline)]">
            {analysis.transactions.map((t, i) => (
              <div key={i} className="flex items-center justify-between gap-3 border-b border-[var(--color-hairline)] px-3 py-2 last:border-0">
                <div className="w-16 flex-none text-[11px] tabular-nums text-[var(--color-text-muted)]">{t.date ?? "—"}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] text-[var(--color-text)]">{t.counterpartyName ?? t.description ?? "—"}</div>
                  <div className="truncate text-[10.5px] text-[var(--color-text-muted)]">
                    {CATEGORY_LABEL[t.category] ?? t.category}
                    {t.accountLast4 ? ` · …${t.accountLast4}` : ""}
                    {t.relatedParty ? " · related party" : ""}
                  </div>
                </div>
                <div className={cn("flex-none tabular-nums text-[12px] font-medium", (t.amountCents ?? 0) < 0 ? "text-[var(--color-negative-text)]" : "text-[var(--color-positive-text)]")}>
                  {t.amountCents != null ? formatCents(t.amountCents) : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
