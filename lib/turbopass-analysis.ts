// Deterministic grouping + income-baseline math over a parsed TurboPass
// extraction. Kept separate from lib/extraction.ts on purpose: the AI's
// job is transcription (every transaction, categorized), not arithmetic —
// LLMs are unreliable at summing dozens of rows correctly. This module
// does the counting, grouping, and the related-party exclusion rule with
// plain deterministic code, so the numbers are trustworthy.

import { turbopassTransactionCategoryValues, type ExtractedData } from "@/lib/extraction-schemas";

type TurbopassData = ExtractedData<"turbopass">;
type RawTransaction = TurbopassData["transactions"][number];
type Category = (typeof turbopassTransactionCategoryValues)[number];

const CATEGORY_SET = new Set<string>(turbopassTransactionCategoryValues);

function normalizeCategory(raw: string | null): Category {
  return raw && CATEGORY_SET.has(raw) ? (raw as Category) : "other";
}

function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s]/g, "");
}

function lastName(name: string): string {
  const parts = normalizeName(name).split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

/** Same last name as any holder on the account = related party, per the finance manager's rule: don't count family/household transfers as income. */
function isRelatedParty(counterpartyName: string, holderNames: string[]): boolean {
  const cpLast = lastName(counterpartyName);
  if (!cpLast) return false;
  return holderNames.some((h) => {
    const hLast = lastName(h);
    return !!hLast && hLast === cpLast;
  });
}

// A TurboPass report usually spans several months. A raw sum of deposits
// over that whole window isn't a monthly figure — dividing by the report's
// own length is what turns "$3,452 over 3 deposits" into a defensible
// "$1,151/mo" baseline. Falls back to 1 month (no normalization) when the
// report doesn't give a period, so a raw total is never silently invented
// as "monthly" without one.
function periodMonths(data: TurbopassData): number {
  if (!data.reportPeriodStart || !data.reportPeriodEnd) return 1;
  const start = new Date(data.reportPeriodStart);
  const end = new Date(data.reportPeriodEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  const days = Math.max(1, (end.getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, days / 30.4375);
}

export interface PayrollGroup {
  holderName: string;
  employer: string;
  totalCents: number;
  monthlyAverageCents: number;
  depositCount: number;
  accountLast4: string | null;
}

export interface CounterpartyGroup {
  name: string;
  count: number;
  totalCents: number;
}

export interface AccountCategoryRow {
  category: Category;
  count: number;
  totalCents: number;
}

export interface AccountSummary {
  last4: string | null;
  institution: string | null;
  accountType: string | null;
  holderNames: string[];
  monthlyDepositsCents: number | null;
  avgDailyBalanceCents: number | null;
  nsfCount: number | null;
  payrollFor: string | null;
  categories: AccountCategoryRow[];
}

export interface AnalyzedTransaction {
  date: string | null;
  description: string | null;
  counterpartyName: string | null;
  category: Category;
  accountLast4: string | null;
  amountCents: number | null;
  relatedParty: boolean;
}

export interface TurboPassAnalysis {
  holders: string[];
  multipleHolders: boolean;
  singleHolderName: string | null;
  periodMonths: number;
  payrollGroups: PayrollGroup[];
  unrelatedTransfers: { totalCents: number; monthlyAverageCents: number; count: number; bySender: CounterpartyGroup[] };
  relatedPartyExcluded: { totalCents: number; count: number; bySender: CounterpartyGroup[] };
  combinedBaselineCents: number;
  accounts: AccountSummary[];
  transactions: AnalyzedTransaction[];
}

export function analyzeTurboPass(data: TurbopassData): TurboPassAnalysis {
  const holders = [...new Set(data.holders.map((h) => h.name?.trim()).filter((n): n is string => !!n))];
  const multipleHolders = holders.length > 2;
  const months = periodMonths(data);

  const accountByLast4 = new Map(data.accounts.filter((a) => a.last4).map((a) => [a.last4 as string, a]));

  function holdersForAccount(accountLast4: string | null): string[] {
    const acct = accountLast4 ? accountByLast4.get(accountLast4) : undefined;
    const names = (acct?.holderNames.filter((n): n is string => !!n) ?? []).map((n) => n.trim());
    return names.length > 0 ? names : holders;
  }

  const normalized: (RawTransaction & { category: Category; holderNames: string[] })[] = data.transactions.map((tx) => {
    const holderNames = holdersForAccount(tx.accountLast4);
    return { ...tx, category: normalizeCategory(tx.category), holderNames };
  });

  // --- Payroll: grouped per holder + employer, so two people on one
  // report never get blended into a single figure. Totals are raw sums
  // over the whole report; monthlyAverageCents is that divided by the
  // report's own length — see periodMonths() above. ---
  const payrollMap = new Map<string, PayrollGroup>();
  for (const tx of normalized) {
    if (tx.category !== "payroll" || tx.amountCents == null || tx.amountCents <= 0) continue;
    const holderName = tx.holderNames[0] ?? "Unknown";
    const employer = tx.counterpartyName?.trim() || tx.description?.trim() || "Payroll";
    const key = `${holderName}::${employer}`;
    const existing = payrollMap.get(key);
    if (existing) {
      existing.totalCents += tx.amountCents;
      existing.depositCount += 1;
    } else {
      payrollMap.set(key, { holderName, employer, totalCents: tx.amountCents, monthlyAverageCents: 0, depositCount: 1, accountLast4: tx.accountLast4 });
    }
  }
  for (const group of payrollMap.values()) group.monthlyAverageCents = Math.round(group.totalCents / months);
  const payrollGroups = [...payrollMap.values()].sort((a, b) => b.monthlyAverageCents - a.monthlyAverageCents);

  // --- Zelle: split related (excluded) vs unrelated (counted), inbound only — outgoing money is never income. ---
  const unrelatedBySender = new Map<string, CounterpartyGroup>();
  const relatedBySender = new Map<string, CounterpartyGroup>();
  for (const tx of normalized) {
    if (tx.category !== "zelle" || tx.amountCents == null || tx.amountCents <= 0) continue;
    const name = tx.counterpartyName?.trim() || "Unknown sender";
    const bucket = isRelatedParty(name, tx.holderNames) ? relatedBySender : unrelatedBySender;
    const existing = bucket.get(name);
    if (existing) {
      existing.count += 1;
      existing.totalCents += tx.amountCents;
    } else {
      bucket.set(name, { name, count: 1, totalCents: tx.amountCents });
    }
  }
  const unrelatedGroups = [...unrelatedBySender.values()].sort((a, b) => b.totalCents - a.totalCents);
  const relatedGroups = [...relatedBySender.values()].sort((a, b) => b.totalCents - a.totalCents);
  const unrelatedTotal = unrelatedGroups.reduce((s, g) => s + g.totalCents, 0);
  const unrelatedMonthlyAverage = Math.round(unrelatedTotal / months);
  const unrelatedCount = unrelatedGroups.reduce((s, g) => s + g.count, 0);
  const relatedTotal = relatedGroups.reduce((s, g) => s + g.totalCents, 0);
  const relatedCount = relatedGroups.reduce((s, g) => s + g.count, 0);

  const combinedBaselineCents = payrollGroups.reduce((s, g) => s + g.monthlyAverageCents, 0) + unrelatedMonthlyAverage;

  // --- Per-account category breakdown, in the taxonomy's display order. ---
  const accounts: AccountSummary[] = data.accounts.map((acct) => {
    const txs = normalized.filter((t) => t.accountLast4 === acct.last4);
    const catTotals = new Map<Category, AccountCategoryRow>();
    for (const tx of txs) {
      const existing = catTotals.get(tx.category);
      const amt = tx.amountCents ?? 0;
      if (existing) {
        existing.count += 1;
        existing.totalCents += amt;
      } else {
        catTotals.set(tx.category, { category: tx.category, count: 1, totalCents: amt });
      }
    }
    const payrollForAccount = payrollGroups.find((g) => g.accountLast4 === acct.last4);
    return {
      last4: acct.last4,
      institution: acct.institution,
      accountType: acct.accountType,
      holderNames: acct.holderNames.filter((n): n is string => !!n),
      monthlyDepositsCents: acct.monthlyDepositsCents,
      avgDailyBalanceCents: acct.avgDailyBalanceCents,
      nsfCount: acct.nsfCount,
      payrollFor: payrollForAccount?.holderName ?? null,
      categories: turbopassTransactionCategoryValues.map((c) => catTotals.get(c)).filter((c): c is AccountCategoryRow => !!c),
    };
  });

  const transactions: AnalyzedTransaction[] = normalized
    .map((tx) => ({
      date: tx.date,
      description: tx.description,
      counterpartyName: tx.counterpartyName,
      category: tx.category,
      accountLast4: tx.accountLast4,
      amountCents: tx.amountCents,
      relatedParty: tx.category === "zelle" && !!tx.counterpartyName && isRelatedParty(tx.counterpartyName, tx.holderNames),
    }))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  return {
    holders,
    multipleHolders,
    singleHolderName: holders.length === 1 ? holders[0] : null,
    periodMonths: months,
    payrollGroups,
    unrelatedTransfers: { totalCents: unrelatedTotal, monthlyAverageCents: unrelatedMonthlyAverage, count: unrelatedCount, bySender: unrelatedGroups },
    relatedPartyExcluded: { totalCents: relatedTotal, count: relatedCount, bySender: relatedGroups },
    combinedBaselineCents,
    accounts,
    transactions,
  };
}
