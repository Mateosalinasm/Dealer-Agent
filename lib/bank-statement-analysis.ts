// Deterministic cross-referencing over several separately-uploaded bank
// statements (each its own document, its own AI extraction — see
// lib/extraction-schemas.ts's bankStatementSchema). Same house rule as
// lib/turbopass-analysis.ts: the AI only transcribes each statement's own
// numbers, this module does the grouping/summing/averaging across them,
// since an LLM isn't reliable arithmetic across multiple documents either.

import type { ExtractedData } from "@/lib/extraction-schemas";

export type BankStatementData = ExtractedData<"bank_statement">;

function normalizeDescription(desc: string): string {
  return desc
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

export interface RecurringDepositGroup {
  description: string; // as first seen, for display
  occurrences: number;
  statementsSeenIn: number; // distinct statements this recurring item showed up in — how "recurring" it really is
  totalCents: number;
  monthlyAverageCents: number; // totalCents / monthsSpanned, not /occurrences — a deposit that only hit 2 of 3 months still isn't a full monthly baseline
}

export interface PerStatementSummary {
  accountHolderName: string | null;
  institution: string | null;
  accountLast4: string | null;
  statementPeriodStart: string | null;
  statementPeriodEnd: string | null;
  beginningBalanceCents: number | null;
  endingBalanceCents: number | null;
  overdraftCount: number | null;
}

export interface BankStatementAnalysis {
  statementCount: number;
  monthsSpanned: number;
  accountHolderNames: string[];
  holderNameMismatch: boolean; // more than one distinct name across statements — flag it, don't guess which is right
  recurringDeposits: RecurringDepositGroup[];
  combinedBaselineCents: number;
  totalOverdraftCount: number;
  perStatement: PerStatementSummary[];
}

// A report usually doesn't give exact statement dates the AI can always
// parse cleanly — falls back to one month per statement (the normal case:
// each upload IS one month's statement) rather than guessing a span from
// unreliable date parsing.
function monthsSpanned(statements: BankStatementData[]): number {
  const periods = new Set(statements.map((s) => s.statementPeriodStart).filter((d): d is string => !!d));
  return periods.size > 0 ? periods.size : statements.length;
}

export function analyzeBankStatements(statements: BankStatementData[]): BankStatementAnalysis {
  const months = monthsSpanned(statements);

  const holderNames = [...new Set(statements.map((s) => s.accountHolderName?.trim()).filter((n): n is string => !!n))];

  const groups = new Map<string, RecurringDepositGroup & { statementIndexesSeen: Set<number> }>();
  statements.forEach((stmt, idx) => {
    for (const dep of stmt.recurringDeposits) {
      if (dep.amountCents == null || dep.amountCents <= 0 || !dep.description) continue;
      const key = normalizeDescription(dep.description);
      const existing = groups.get(key);
      if (existing) {
        existing.occurrences += 1;
        existing.totalCents += dep.amountCents;
        existing.statementIndexesSeen.add(idx);
      } else {
        groups.set(key, {
          description: dep.description.trim(),
          occurrences: 1,
          totalCents: dep.amountCents,
          statementsSeenIn: 0,
          monthlyAverageCents: 0,
          statementIndexesSeen: new Set([idx]),
        });
      }
    }
  });

  const recurringDeposits: RecurringDepositGroup[] = [...groups.values()]
    .map((g) => ({
      description: g.description,
      occurrences: g.occurrences,
      statementsSeenIn: g.statementIndexesSeen.size,
      totalCents: g.totalCents,
      monthlyAverageCents: Math.round(g.totalCents / months),
    }))
    .sort((a, b) => b.monthlyAverageCents - a.monthlyAverageCents);

  const combinedBaselineCents = recurringDeposits.reduce((sum, g) => sum + g.monthlyAverageCents, 0);
  const totalOverdraftCount = statements.reduce((sum, s) => sum + (s.overdraftCount ?? 0), 0);

  const perStatement: PerStatementSummary[] = statements.map((s) => ({
    accountHolderName: s.accountHolderName,
    institution: s.institution,
    accountLast4: s.accountLast4,
    statementPeriodStart: s.statementPeriodStart,
    statementPeriodEnd: s.statementPeriodEnd,
    beginningBalanceCents: s.beginningBalanceCents,
    endingBalanceCents: s.endingBalanceCents,
    overdraftCount: s.overdraftCount,
  }));

  return {
    statementCount: statements.length,
    monthsSpanned: months,
    accountHolderNames: holderNames,
    holderNameMismatch: holderNames.length > 1,
    recurringDeposits,
    combinedBaselineCents,
    totalOverdraftCount,
    perStatement,
  };
}
