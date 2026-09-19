import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { AccordionSection } from "@/components/accordion-section";
import { StipChecklist } from "@/components/stip-checklist";
import { StageChecklist } from "@/components/stage-checklist";
import { DocumentRow } from "@/components/document-row";
import { LenderMatchCard } from "@/components/lender-match-card";
import { DealHealthCard } from "@/components/deal-health-card";
import { MoneyTradeSection } from "@/components/money-trade-section";
import { PtiSection } from "@/components/pti-section";
import { CustomerSection } from "@/components/customer-section";
import { SubmissionsSection } from "@/components/submissions-section";
import { getUnderwritingSnapshot } from "@/lib/deal-underwriting";
import { dealFacts, ptiCalc } from "@/lib/deal-facts";
import { dealHealth, nextAction, bucketOf } from "@/lib/deal-health";
import { dealStageInfo, STAGES } from "@/lib/deal-stage";
import { matchProgram } from "@/lib/lender-match";
import { setDealArchived, updateDealInfo, uploadDocument } from "@/app/desk/deals/actions";
import type { ProgramForMatch, TitleStatus } from "@/lib/lender-match";

const CATEGORY_LABEL: Record<string, string> = {
  turbopass: "TurboPass",
  bank_statement: "Bank statement",
  credit_report: "Credit report",
  credit_app: "Credit app",
  insurance: "Insurance",
  other: "Other",
};

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, id)).limit(1);
  if (!deal) notFound();

  const [vehicle, lenders, programs, documents, stockVehicles, snapshot] = await Promise.all([
    deal.vehicleId
      ? db.select().from(schema.vehicles).where(eq(schema.vehicles.id, deal.vehicleId)).then((r) => r[0] ?? null)
      : Promise.resolve(null),
    db.select().from(schema.lenders).where(eq(schema.lenders.active, true)),
    db.select().from(schema.lenderPrograms),
    db.select().from(schema.documents).where(eq(schema.documents.dealId, id)),
    db.select().from(schema.vehicles).where(eq(schema.vehicles.sold, false)),
    getUnderwritingSnapshot(id),
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

  const matchVehicles = (vehicle && !stockVehicles.some((v) => v.id === vehicle.id) ? [vehicle, ...stockVehicles] : stockVehicles).map(
    (v) => ({
      id: v.id,
      year: v.year,
      make: v.make,
      model: v.model,
      trim: v.trim,
      askingPrice: v.askingPrice,
      bookValue: v.bookValue,
      miles: v.miles,
      title: v.title as TitleStatus,
    }),
  );

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
  const pti = ptiCalc(deal, facts);

  const openStips = deal.stips.filter((s) => !s.done).length;
  const activeSub = deal.subs.find((s) => s.id === deal.primarySubId) ?? deal.subs.find((s) => s.status === "approved") ?? null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">{deal.customerName}</h1>
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
          <Link href={`/desk/appointments?dealId=${id}&customerName=${encodeURIComponent(deal.customerName ?? "")}`}>
            <Button type="button" variant="secondary">
              Schedule appointment
            </Button>
          </Link>
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

      <div className="flex flex-col gap-4">
        <DealHealthCard dealId={id} health={health} />

        <AccordionSection title="Customer" summary={facts.vehicleLabel || "No vehicle · Pending submission"} defaultOpen>
          <CustomerSection dealId={id} deal={deal} lenders={lenders} />
        </AccordionSection>

        <AccordionSection
          title="Money & trade"
          summary={facts.totalGross != null ? `${(facts.totalGross / 100).toLocaleString(undefined, { style: "currency", currency: "USD" })} gross` : "Nothing entered yet"}
        >
          <MoneyTradeSection dealId={id} facts={facts} tradeVehicle={deal.tradeVehicle} />
        </AccordionSection>

        <AccordionSection title="Lender & vehicle match">
          <LenderMatchCard vehicles={matchVehicles} initialVehicleId={deal.vehicleId} programs={matchPrograms} snapshot={snapshot} />
        </AccordionSection>

        <AccordionSection title="Submissions" summary={deal.subs.length ? `${deal.subs.length} submission${deal.subs.length === 1 ? "" : "s"}` : "Not submitted"}>
          <SubmissionsSection dealId={id} subs={deal.subs} lenders={lenders} primarySubId={deal.primarySubId} />
        </AccordionSection>

        <AccordionSection title="PTI calculator" summary={activeSub?.apr != null ? `${activeSub.apr / 100}% APR on file` : undefined}>
          <PtiSection dealId={id} facts={facts} pti={pti} ptiPriceOverride={deal.ptiPrice} openAutoTradeIn={deal.openAutoTradeIn} />
        </AccordionSection>

        <AccordionSection title="Stage checklist" summary={`${stageInfo.doneCount}/${stageInfo.total} steps · ${STAGES[Math.min(stageInfo.stageIdx, 2)].name}`}>
          <StageChecklist dealId={id} done={deal.done} />
        </AccordionSection>

        <AccordionSection title="Stips" summary={openStips ? `${openStips} open` : "Clear"}>
          <StipChecklist dealId={id} stips={deal.stips} />
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
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)]">Used for PTI/payment estimates only when no submission has its own rate/term yet.</p>
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
            <Textarea name="notes" rows={4} defaultValue={deal.notes ?? ""} />
            <Button type="submit" variant="secondary" className="self-end">
              Save
            </Button>
          </form>
        </AccordionSection>

        <AccordionSection title="History" summary={deal.log.length ? `${deal.log.length} entr${deal.log.length === 1 ? "y" : "ies"}` : "Nothing recorded yet"}>
          {deal.log.length === 0 ? (
            <p className="text-[12.5px] text-[var(--color-text-muted)]">
              Nothing recorded yet. Submissions, approvals, stips and checklist steps all write a line here as you work.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {[...deal.log]
                .reverse()
                .map((entry, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 text-[12.5px]">
                    <span className="text-[var(--color-text)]">{entry.text}</span>
                    <span className="flex-none tabular-nums text-[var(--color-text-muted)]">
                      {new Date(entry.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </AccordionSection>

        <Card>
          <div className="mb-3 text-[13.5px] font-semibold text-[var(--color-text)]">Documents</div>
          <form action={uploadDocument.bind(null, id)} className="mb-4 flex flex-wrap items-end gap-3">
            <div className="w-48">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">Type</div>
              <Select name="category" defaultValue="credit_app">
                {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
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

          {documents.length === 0 ? (
            <p className="text-[12.5px] text-[var(--color-text-muted)]">No documents uploaded yet.</p>
          ) : (
            <div className="flex flex-col">
              {documents.map((docRow) => (
                <DocumentRow key={docRow.id} document={{ ...docRow, dealId: id }} />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
