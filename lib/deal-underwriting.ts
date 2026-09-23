import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { EXTRACTION_SCHEMAS } from "@/lib/extraction-schemas";
import { analyzeTurboPass } from "@/lib/turbopass-analysis";

export interface UnderwritingSnapshot {
  creditScore: number | null;
  creditScoreSource: string | null;
  monthlyIncomeCents: number | null;
  incomeSource: string | null;
}

type DocumentRow = typeof schema.documents.$inferSelect;

/**
 * Pulls the best available credit score and income figure out of a deal's
 * already-extracted documents (see lib/extraction.ts). Prefers verified
 * sources (TurboPass, credit report) over self-reported ones (credit app),
 * and never guesses — a field stays null if nothing extracted has it.
 */
export async function getUnderwritingSnapshot(dealId: string): Promise<UnderwritingSnapshot> {
  const docs = await db
    .select()
    .from(schema.documents)
    .where(and(eq(schema.documents.dealId, dealId), eq(schema.documents.extractionStatus, "success")));

  return snapshotFromDocs(docs);
}

/**
 * Same as getUnderwritingSnapshot, but for every deal in one query — used by
 * the board (app/desk/deals/page.tsx) so the badges next to each card don't
 * cost one query per deal.
 */
export async function getUnderwritingSnapshotsForDeals(dealIds: string[]): Promise<Map<string, UnderwritingSnapshot>> {
  if (dealIds.length === 0) return new Map();
  const docs = await db
    .select()
    .from(schema.documents)
    .where(and(inArray(schema.documents.dealId, dealIds), eq(schema.documents.extractionStatus, "success")));

  const byDeal = new Map<string, DocumentRow[]>();
  for (const doc of docs) {
    if (!doc.dealId) continue;
    const list = byDeal.get(doc.dealId);
    if (list) list.push(doc);
    else byDeal.set(doc.dealId, [doc]);
  }

  return new Map(dealIds.map((id) => [id, snapshotFromDocs(byDeal.get(id) ?? [])]));
}

function snapshotFromDocs(docs: DocumentRow[]): UnderwritingSnapshot {
  let creditScore: number | null = null;
  let creditScoreSource: string | null = null;
  const creditDoc = docs.find((d) => d.category === "credit_report");
  if (creditDoc) {
    const parsed = EXTRACTION_SCHEMAS.credit_report.safeParse(creditDoc.extractedData);
    if (parsed.success) {
      const scores = parsed.data.scores.filter(
        (s): s is { bureau: string | null; score: number } => s.score != null,
      );
      if (scores.length > 0) {
        // Conservative: use the lowest bureau score, same convention lenders use for tri-merge pulls.
        const lowest = scores.reduce((min, s) => (s.score < min.score ? s : min));
        creditScore = lowest.score;
        creditScoreSource = `Credit report${lowest.bureau ? ` (${lowest.bureau})` : ""}`;
      }
    }
  }

  let monthlyIncomeCents: number | null = null;
  let incomeSource: string | null = null;

  const turbopassDoc = docs.find((d) => d.category === "turbopass");
  if (turbopassDoc) {
    const parsed = EXTRACTION_SCHEMAS.turbopass.safeParse(turbopassDoc.extractedData);
    if (parsed.success) {
      // The deterministic combined baseline (payroll + unrelated transfers,
      // related-party excluded — lib/turbopass-analysis.ts) is trustworthy
      // arithmetic; the model's own totalMonthlyIncomeCents is just its
      // best-effort cross-check guess and only falls back to it when there's
      // no transaction data to compute the real figure from (e.g. an older
      // extraction from before this schema).
      if (parsed.data.transactions.length > 0) {
        monthlyIncomeCents = analyzeTurboPass(parsed.data).combinedBaselineCents;
        incomeSource = "TurboPass";
      } else if (parsed.data.totalMonthlyIncomeCents != null) {
        monthlyIncomeCents = parsed.data.totalMonthlyIncomeCents;
        incomeSource = "TurboPass";
      }
    }
  }

  if (monthlyIncomeCents == null) {
    const bankDoc = docs.find((d) => d.category === "bank_statement");
    if (bankDoc) {
      const parsed = EXTRACTION_SCHEMAS.bank_statement.safeParse(bankDoc.extractedData);
      if (parsed.success && parsed.data.recurringDeposits.length > 0) {
        const sum = parsed.data.recurringDeposits.reduce((total, dep) => total + (dep.amountCents ?? 0), 0);
        if (sum > 0) {
          monthlyIncomeCents = sum;
          incomeSource = "Bank statement (recurring deposits)";
        }
      }
    }
  }

  if (monthlyIncomeCents == null) {
    const appDoc = docs.find((d) => d.category === "credit_app");
    if (appDoc) {
      const parsed = EXTRACTION_SCHEMAS.credit_app.safeParse(appDoc.extractedData);
      if (parsed.success && parsed.data.monthlyIncomeStatedCents != null) {
        monthlyIncomeCents = parsed.data.monthlyIncomeStatedCents;
        incomeSource = "Credit app (self-reported)";
      }
    }
  }

  return { creditScore, creditScoreSource, monthlyIncomeCents, incomeSource };
}
