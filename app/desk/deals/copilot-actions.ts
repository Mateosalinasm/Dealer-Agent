"use server";

import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { askCopilot, copilotConfigured, type CopilotMessage, type CopilotResult } from "@/lib/deal-copilot";
import { getUnderwritingSnapshot } from "@/lib/deal-underwriting";
import { dealFacts } from "@/lib/deal-facts";
import { dealHealth, nextAction } from "@/lib/deal-health";
import { gradeCredit } from "@/lib/credit-grade";
import { matchAllPrograms, type ProgramForMatch, type TitleStatus } from "@/lib/lender-match";
import { matchWarrantyProducts, type WarrantyProductForMatch } from "@/lib/warranty-match";
import { formatCents } from "@/lib/utils";

function buildContextBlock(
  deal: typeof schema.deals.$inferSelect,
  vehicle: typeof schema.vehicles.$inferSelect | null,
): Promise<string> {
  return (async () => {
    const [lenders, programs, warrantyProductRows, snapshot] = await Promise.all([
      db.select().from(schema.lenders).where(eq(schema.lenders.active, true)),
      db.select().from(schema.lenderPrograms),
      db.select().from(schema.warrantyProducts).where(eq(schema.warrantyProducts.active, true)),
      getUnderwritingSnapshot(deal.id),
    ]);

    const lenderNameById = new Map(lenders.map((l) => [l.id, l.name]));
    const matchPrograms: ProgramForMatch[] = programs
      .filter((p) => lenderNameById.has(p.lenderId))
      .map((p) => ({
        lenderId: p.lenderId,
        lenderName: lenderNameById.get(p.lenderId)!,
        programId: p.id,
        programLabel: p.label,
        advancePct: p.advancePct,
        maxLtvPct: p.maxLtvPct,
        maxTermMonths: p.maxTermMonths,
        maxMiles: p.maxMiles,
        maxAgeYears: p.maxAgeYears,
        allowedTitles: p.allowedTitles as TitleStatus[] | null,
        minCreditScore: p.minCreditScore,
        maxPtiPct: p.maxPtiPct,
        typicalAprBps: p.typicalAprBps,
      }));

    const facts = dealFacts(deal, vehicle);
    const health = dealHealth(deal, facts);
    const next = nextAction(deal, facts, health);
    const grade = gradeCredit(deal);
    const monthlyIncomeCents = snapshot.monthlyIncomeCents ?? facts.income;

    const lines: string[] = [];
    lines.push(`Customer: ${deal.customerName ?? "Unnamed"}`);
    lines.push(`Vehicle: ${facts.vehicleLabel || "Not linked to inventory"}`);
    if (vehicle) {
      lines.push(`  Asking price ${formatCents(vehicle.askingPrice)}, ${vehicle.miles?.toLocaleString() ?? "unknown"} miles, title ${vehicle.title}`);
    }
    lines.push(`Sale price: ${formatCents(deal.salePrice)}, cash down: ${formatCents(deal.cashDown)}`);
    lines.push(`Amount financed: ${formatCents(facts.amountFinanced)}, LTV: ${facts.ltv != null ? `${facts.ltv}%` : "unknown"}`);
    lines.push(`FICO: ${deal.fico ?? "unknown"}${deal.fico ? ` (grade ${grade.grade})` : ""}, ID type: ${deal.idType ?? "unknown"}`);
    lines.push(`Monthly income: ${monthlyIncomeCents != null ? `${formatCents(monthlyIncomeCents)}/mo (${snapshot.incomeSource ?? "source unknown"})` : "unknown"}`);
    lines.push(`Existing open-auto payment: ${formatCents(deal.openAutoPayment)}`);
    lines.push(`Deal health: ${health.status}${health.issues.length > 0 ? ` — ${health.issues.map((i) => i.title).join("; ")}` : ""}`);
    lines.push(`Next action per the app: ${next.label}`);

    if (vehicle && vehicle.askingPrice != null) {
      const applicant = {
        creditScore: deal.fico,
        monthlyIncomeCents,
        availableDownCents: deal.cashDown ?? 0,
        openAutoPaymentCents: deal.openAutoPayment,
      };
      const results = matchAllPrograms(
        { askingPriceCents: vehicle.askingPrice, bookValueCents: vehicle.bookValue, miles: vehicle.miles, year: vehicle.year, title: vehicle.title as TitleStatus },
        applicant,
        matchPrograms,
      );
      lines.push("");
      lines.push("Lender program matches (best first):");
      if (results.length === 0) {
        lines.push("  No lender programs on file.");
      } else {
        for (const r of results.slice(0, 8)) {
          const bits = [`${r.lenderName} (${r.programLabel})`, r.status];
          if (r.estimatedMonthlyPaymentCents != null) bits.push(`~${formatCents(r.estimatedMonthlyPaymentCents)}/mo`);
          if (r.status === "flagged") bits.push(r.applicantFlags.map((f) => f.reason).join("; "));
          if (r.status === "excluded") bits.push(r.collateralStops.join("; "));
          lines.push(`  - ${bits.join(" — ")}`);
        }
      }
    } else {
      lines.push("");
      lines.push("No vehicle linked (or no asking price) — lender program matching wasn't run.");
    }

    const warrantyProducts: WarrantyProductForMatch[] = warrantyProductRows.map((p) => ({
      id: p.id,
      name: p.name,
      provider: p.provider,
      productType: p.productType,
      costCents: p.costCents,
      priceCents: p.priceCents,
      termMonths: p.termMonths,
      termMiles: p.termMiles,
      deductibleCents: p.deductibleCents,
      maxVehicleAgeYears: p.maxVehicleAgeYears,
      maxVehicleMiles: p.maxVehicleMiles,
      minSalePriceCents: p.minSalePriceCents,
      maxSalePriceCents: p.maxSalePriceCents,
      active: p.active,
    }));
    const warrantyResults = matchWarrantyProducts(
      { year: vehicle?.year ?? null, miles: vehicle?.miles ?? null },
      { salePriceCents: deal.salePrice, cashDownCents: deal.cashDown, tradePayoffCents: deal.tradePayoff, tradeAcvCents: deal.tradeAcv },
      warrantyProducts,
    );
    const eligibleWarranty = warrantyResults.filter((r) => r.eligible);
    lines.push("");
    lines.push("F&I / warranty products eligible for this deal:");
    if (eligibleWarranty.length === 0) {
      lines.push("  None on file, or none eligible.");
    } else {
      for (const r of eligibleWarranty.slice(0, 10)) {
        lines.push(`  - ${r.name} (${r.provider}, ${r.productType}): sells ${formatCents(r.priceCents)}, margin ${formatCents(r.marginCents)}${r.recommended ? ` — RECOMMENDED: ${r.recommendReason}` : ""}`);
      }
    }

    return lines.join("\n");
  })();
}

export async function askDealCopilot(dealId: string, history: CopilotMessage[]): Promise<CopilotResult> {
  if (!copilotConfigured()) {
    return { ok: false, error: "Deal Copilot isn't connected yet — add ANTHROPIC_API_KEY to .env.local to enable it." };
  }

  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, dealId)).limit(1);
  if (!deal) return { ok: false, error: "Deal not found." };
  const vehicle = deal.vehicleId
    ? (await db.select().from(schema.vehicles).where(eq(schema.vehicles.id, deal.vehicleId)).limit(1))[0] ?? null
    : null;

  const contextBlock = await buildContextBlock(deal, vehicle);
  return askCopilot(contextBlock, history);
}
