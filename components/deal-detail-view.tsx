import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { AccordionSection } from "@/components/accordion-section";
import { StageChecklist } from "@/components/stage-checklist";
import { DocumentRow } from "@/components/document-row";
import { LenderVehicleMatchModal } from "@/components/lender-vehicle-match-modal";
import { WarrantyMatchModal } from "@/components/warranty-match-modal";
import { DealCopilotModal } from "@/components/deal-copilot-modal";
import { SendReferralButton } from "@/components/send-referral-button";
import { DealTasksSection } from "@/components/deal-tasks-section";
import { ScheduleAppointmentModal } from "@/components/schedule-appointment-modal";
import { copilotConfigured } from "@/lib/deal-copilot";
import { DealHealthCard } from "@/components/deal-health-card";
import { PtiSection } from "@/components/pti-section";
import { CustomerSection } from "@/components/customer-section";
import { CreditGradeBadge } from "@/components/credit-grade-modal";
import { IncomeReportBadge } from "@/components/income-report-badge";
import { getUnderwritingSnapshot } from "@/lib/deal-underwriting";
import { dealFacts, dealApr, dealTerm, ptiCalc, PTI_TARGETS } from "@/lib/deal-facts";
import { dealHealth, nextAction, bucketOf } from "@/lib/deal-health";
import { dealStageInfo, STAGES } from "@/lib/deal-stage";
import { matchProgram } from "@/lib/lender-match";
import { analyzeDocument, deleteDocument, setDealArchived, updateDealInfo, uploadDocument } from "@/app/desk/deals/actions";
import type { ProgramForMatch, TitleStatus, VehicleCandidate } from "@/lib/lender-match";

// The full deal-detail screen. Rendered both as a real page
// (app/desk/deals/[id]/page.tsx — direct nav, refresh, deep link) and
// inside an intercepted-route modal (app/desk/deals/@modal/(.)[id]/page.tsx
// — clicking a card from the board) so the two never drift apart.
export async function DealDetailView({ id }: { id: string }) {
  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, id)).limit(1);
  if (!deal) notFound();

  const [vehicle, lenders, programs, documents, stockVehicles, snapshot, warrantyProducts, tasks] = await Promise.all([
    deal.vehicleId
      ? db.select().from(schema.vehicles).where(eq(schema.vehicles.id, deal.vehicleId)).then((r) => r[0] ?? null)
      : Promise.resolve(null),
    db.select().from(schema.lenders).where(eq(schema.lenders.active, true)),
    db.select().from(schema.lenderPrograms),
    db.select().from(schema.documents).where(eq(schema.documents.dealId, id)),
    db.select().from(schema.vehicles).where(eq(schema.vehicles.sold, false)),
    getUnderwritingSnapshot(id),
    db.select().from(schema.warrantyProducts).where(eq(schema.warrantyProducts.active, true)),
    db.select().from(schema.tasks).where(eq(schema.tasks.dealId, id)),
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

  const combinedVehicles = vehicle && !stockVehicles.some((v) => v.id === vehicle.id) ? [vehicle, ...stockVehicles] : stockVehicles;
  const matchVehicles = combinedVehicles.map((v) => ({
    id: v.id,
    year: v.year,
    make: v.make,
    model: v.model,
    trim: v.trim,
    askingPrice: v.askingPrice,
    bookValue: v.bookValue,
    miles: v.miles,
    title: v.title as TitleStatus,
  }));
  const inventoryCandidates: VehicleCandidate[] = combinedVehicles.map((v) => ({
    id: v.id,
    year: v.year,
    make: v.make,
    model: v.model,
    trim: v.trim,
    askingPriceCents: v.askingPrice,
    bookValueCents: v.bookValue,
    miles: v.miles,
    title: v.title as TitleStatus,
    bodyType: v.bodyType,
  }));

  // --- Derived facts / health / stage (lib/deal-facts.ts, lib/deal-health.ts, lib/deal-stage.ts) ---
  const facts = dealFacts(deal, vehicle);
  const chosenProgram = deal.programId ? matchPrograms.find((p) => p.programId === deal.programId) : undefined;
  const chosenProgramMatch =
    vehicle && chosenProgram
      ? matchProgram(
          { askingPriceCents: vehicle.askingPrice ?? 0, bookValueCents: vehicle.bookValue, miles: vehicle.miles, year: vehicle.year, title: vehicle.title as TitleStatus },
          { creditScore: deal.fico, monthlyIncomeCents: facts.income, availableDownCents: deal.cashDown ?? 0 },
          chosenProgram,
        )
      : null;
  const health = dealHealth(deal, facts, chosenProgramMatch);
  const next = nextAction(deal, facts, health);
  const bucket = bucketOf(next.bucket);
  const stageInfo = dealStageInfo(deal.done);
  const pti = ptiCalc({
    income: facts.income,
    price: deal.ptiPrice ?? facts.sellPrice,
    pct: deal.ptiPct || PTI_TARGETS[0],
    apr: dealApr(deal),
    term: dealTerm(deal),
    existing: facts.openAutoPayment ?? 0,
    down: facts.down,
  });

  const openStips = deal.stips.filter((s) => !s.done).length;
  const activeSub = deal.subs.find((s) => s.id === deal.primarySubId) ?? deal.subs.find((s) => s.status === "approved") ?? null;

  const creditReportDocs = documents.filter((d) => d.category === "credit_report");
  const incomeDocs = documents.filter((d) => d.category === "turbopass" || d.category === "bank_statement");

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">{deal.customerName}</h1>
            <CreditGradeBadge dealId={id} customerName={deal.customerName ?? ""} vehicleLabel={facts.vehicleLabel} facts={deal} creditReportDocs={creditReportDocs} />
            <IncomeReportBadge
              dealId={id}
              customerName={deal.customerName ?? ""}
              incomeSource={snapshot.incomeSource}
              monthlyIncomeCents={snapshot.monthlyIncomeCents}
              documents={incomeDocs}
            />
          </div>
          <div className="mt-1 flex items-center gap-2 text-[12.5px] text-[var(--color-text-muted)]">
            <span>{facts.vehicleLabel || "No vehicle attached"}</span>
            <span>
              · {openStips} stip{openStips === 1 ? "" : "s"} open
            </span>
            <span>· {stageInfo.pct}% through</span>
          </div>
        </div>
        <div className="flex flex-none items-center gap-2">
          <Badge tone={deal.funded ? "positive" : "neutral"}>{deal.funded ? "Funded" : "Open"}</Badge>
          {deal.funded && <SendReferralButton dealId={id} />}
          <ScheduleAppointmentModal dealId={id} customerName={deal.customerName ?? ""} phone={deal.phone} vehicles={combinedVehicles} />
          <form action={setDealArchived.bind(null, id, !deal.archived)}>
            <Button type="submit" variant="secondary">
              {deal.archived ? "Restore" : "Archive"}
            </Button>
          </form>
        </div>
      </div>

      {/* Next action banner */}
      <div className="mb-4 rounded-[var(--radius-card)] bg-[#1d1d1f] p-4">
        <div className="flex items-center gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[.06em] text-[var(--color-text-placeholder)]">Next action</div>
          <div
            className="ml-auto rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[.04em]"
            style={{ background: bucket.bg, color: bucket.fg }}
          >
            {bucket.label}
          </div>
        </div>
        <div className="mt-1.5 text-[16px] font-semibold leading-tight text-white">{next.label}</div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <LenderVehicleMatchModal
          dealId={id}
          customerName={deal.customerName ?? ""}
          vehicleLabel={facts.vehicleLabel}
          creditFacts={deal}
          idType={deal.idType}
          wantBodyType={deal.wantBodyType}
          monthlyIncomeCents={snapshot.monthlyIncomeCents ?? facts.income}
          incomeSource={snapshot.incomeSource}
          cashDownCents={deal.cashDown}
          openAutoPaymentCents={facts.openAutoPayment}
          amountFinancedCents={facts.amountFinanced}
          ltvPct={facts.ltv}
          linkedVehicle={
            vehicle && {
              id: vehicle.id,
              year: vehicle.year,
              make: vehicle.make,
              model: vehicle.model,
              trim: vehicle.trim,
              askingPriceCents: vehicle.askingPrice,
              bookValueCents: vehicle.bookValue,
              miles: vehicle.miles,
              title: vehicle.title as TitleStatus,
              bodyType: vehicle.bodyType,
            }
          }
          programs={matchPrograms}
          inventory={inventoryCandidates}
          attentionNeeded={health.status !== "green"}
        />
        <WarrantyMatchModal
          customerName={deal.customerName ?? ""}
          vehicle={{ year: vehicle?.year ?? null, miles: vehicle?.miles ?? null }}
          deal={{ salePriceCents: deal.salePrice, cashDownCents: deal.cashDown, tradePayoffCents: deal.tradePayoff, tradeAcvCents: deal.tradeAcv }}
          products={warrantyProducts.map((p) => ({
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
          }))}
        />
        <DealCopilotModal dealId={id} customerName={deal.customerName ?? ""} configured={copilotConfigured()} />
      </div>

      <div className="flex flex-col gap-4">
        <DealHealthCard dealId={id} health={health} />

        <AccordionSection title="Customer" summary={facts.vehicleLabel || "No vehicle · Pending submission"} defaultOpen>
          <CustomerSection dealId={id} deal={deal} lenders={lenders} vehicles={matchVehicles} />
        </AccordionSection>

        <AccordionSection title="PTI calculator" summary={activeSub?.apr != null ? `${activeSub.apr / 100}% APR on file` : undefined}>
          <PtiSection dealId={id} facts={facts} pti={pti} ptiPriceOverride={deal.ptiPrice} openAutoTradeIn={deal.openAutoTradeIn} />
        </AccordionSection>

        <AccordionSection
          title="Stage checklist"
          summary={`${stageInfo.doneCount}/${stageInfo.total} steps · ${STAGES[Math.min(stageInfo.stageIdx, 2)].name}${openStips ? ` · ${openStips} stip${openStips === 1 ? "" : "s"} open` : ""}`}
        >
          <StageChecklist dealId={id} done={deal.done} stips={deal.stips} />
        </AccordionSection>

        <AccordionSection title="Tasks" summary={tasks.filter((t) => !t.done).length ? `${tasks.filter((t) => !t.done).length} open` : undefined}>
          <DealTasksSection dealId={id} tasks={tasks} />
        </AccordionSection>

        <AccordionSection title="Program & terms" summary={deal.termMonths ? `${deal.termMonths} mo · ${deal.apr != null ? deal.apr / 100 : "?"}% fallback` : undefined}>
          <form action={updateDealInfo.bind(null, id)} className="flex flex-col gap-3">
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">Program</div>
              <Select name="programId" defaultValue={deal.programId ?? ""}>
                <option value="">—</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">Term (months, fallback)</div>
                <input
                  name="termMonths"
                  type="number"
                  defaultValue={deal.termMonths ?? ""}
                  className="w-full rounded-[var(--radius-panel)] border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-2 text-[13.5px] outline-none focus:border-[var(--color-primary)]"
                />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">APR % (fallback)</div>
                <input
                  name="aprPct"
                  type="number"
                  step="0.01"
                  defaultValue={deal.apr != null ? deal.apr / 100 : ""}
                  className="w-full rounded-[var(--radius-panel)] border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-2 text-[13.5px] outline-none focus:border-[var(--color-primary)]"
                />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">Commission</div>
                <input
                  name="commissionDollars"
                  type="number"
                  step="0.01"
                  defaultValue={deal.commission != null ? deal.commission / 100 : ""}
                  className="w-full rounded-[var(--radius-panel)] border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-2 text-[13.5px] outline-none focus:border-[var(--color-primary)]"
                />
              </div>
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)]">Term/APR are used for PTI/payment estimates only when no submission has its own rate/term yet. Commission drives the pipeline board&rsquo;s monthly total.</p>
            <input type="hidden" name="notes" value={deal.notes ?? ""} />
            <Button type="submit" variant="secondary" className="self-end">
              Save
            </Button>
          </form>
        </AccordionSection>

        <AccordionSection title="Notes" summary={deal.notes ? undefined : "Nothing yet"}>
          <form action={updateDealInfo.bind(null, id)} className="flex flex-col gap-2">
            <input type="hidden" name="programId" value={deal.programId ?? ""} />
            <input type="hidden" name="termMonths" value={deal.termMonths ?? ""} />
            <input type="hidden" name="aprPct" value={deal.apr != null ? deal.apr / 100 : ""} />
            <input type="hidden" name="commissionDollars" value={deal.commission != null ? deal.commission / 100 : ""} />
            <Textarea name="notes" rows={4} defaultValue={deal.notes ?? ""} />
            <Button type="submit" variant="secondary" className="self-end">
              Save
            </Button>
          </form>
        </AccordionSection>

        <Card id="documents">
          <div className="mb-1 text-[13.5px] font-semibold text-[var(--color-text)]">Documents</div>
          <p className="mb-3 text-[11px] text-[var(--color-text-muted)]">
            Credit reports, TurboPass/bank statements, and the credit app each upload from their own spot — the
            credit grade badge, the income badge, and the New Deal form. This is everything on file for the deal,
            plus a place for anything else.
          </p>

          {documents.length === 0 ? (
            <p className="mb-3 text-[12.5px] text-[var(--color-text-muted)]">No documents uploaded yet.</p>
          ) : (
            <div className="mb-3 flex flex-col">
              {documents.map((docRow) => (
                <DocumentRow
                  key={docRow.id}
                  document={docRow}
                  onAnalyze={analyzeDocument.bind(null, id)}
                  onDelete={deleteDocument.bind(null, id)}
                />
              ))}
            </div>
          )}

          <form action={uploadDocument.bind(null, id)} className="flex flex-wrap items-end gap-3 border-t border-[var(--color-hairline)] pt-3">
            <div className="w-40">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">Type</div>
              <Select name="category" defaultValue="insurance">
                <option value="insurance">Insurance</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <div className="flex-1">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">File</div>
              <input
                name="file"
                type="file"
                required
                className="block w-full text-[12.5px] text-[var(--color-text-muted)] file:mr-3 file:rounded-[var(--radius-pill)] file:border-0 file:bg-[var(--color-fill-subtle)] file:px-3 file:py-1.5 file:text-[12px] file:font-semibold"
              />
            </div>
            <Button type="submit" variant="secondary">
              Upload
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
