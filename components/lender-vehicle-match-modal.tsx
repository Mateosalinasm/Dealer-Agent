"use client";

import { useMemo, useState, useTransition } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/utils";
import { gradeCredit, type CreditFacts } from "@/lib/credit-grade";
import { setDealVehicle } from "@/app/desk/deals/actions";
import {
  matchAllPrograms,
  matchVehiclesForApplicant,
  type ProgramForMatch,
  type ProgramMatchResult,
  type VehicleCandidate,
  type VehicleMatchResult,
  type ExceptionLikelihood,
} from "@/lib/lender-match";

// Dealership-specific relationship, not a general lending rule: Westlake
// gives the dealership's best approval odds for US-ID/driver's-license
// customers, so it's bumped to the top of the list for them. Doesn't
// change collateral or applicant gates — just the tie-break order within
// a status tier (see matchAllPrograms in lib/lender-match.ts).
const WESTLAKE_PRIORITY_ID_TYPES = new Set(["US ID"]);
const WESTLAKE_PRIORITY_LENDERS = ["Westlake"];

const LIKELIHOOD_LABEL: Record<ExceptionLikelihood, string> = {
  strong: "Potential match — worth a call",
  possible: "Potential match — needs review",
  unlikely: "Long shot",
};

const STATUS_TONE = { fits: "positive", flagged: "caution", excluded: "negative" } as const;

function vehicleLabel(v: { year: number | null; make: string | null; model: string | null; trim: string | null }) {
  return [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ") || "Unlabeled vehicle";
}

function statusLabel(r: ProgramMatchResult) {
  if (r.status === "fits") return "Fits";
  if (r.status === "excluded") return "Doesn't fit";
  return r.exceptionLikelihood ? LIKELIHOOD_LABEL[r.exceptionLikelihood] : "Flagged";
}

function LenderRow({ result }: { result: ProgramMatchResult }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-[var(--radius-panel)] border border-[var(--color-hairline)] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2 w-2 flex-none rounded-full"
            style={{ background: `var(--color-${STATUS_TONE[result.status]})` }}
          />
          <span className="truncate text-[13.5px] font-semibold text-[var(--color-text)]">{result.lenderName}</span>
          <Badge tone={STATUS_TONE[result.status]}>{statusLabel(result)}</Badge>
        </div>
        <button type="button" className="flex-none text-[12px] font-semibold text-[var(--color-primary)] hover:underline" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide" : "Why?"}
        </button>
      </div>

      {open && (
        <div className="mt-2.5 flex flex-col gap-1.5 border-t border-[var(--color-hairline)] pt-2.5 text-[11.5px]">
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[var(--color-text-muted)]">
            <span>Max advance {formatCents(result.maxAdvanceCents)}</span>
            <span>Required down {formatCents(result.requiredDownCents)}</span>
            {result.estimatedMonthlyPaymentCents != null && <span>Est. payment {formatCents(result.estimatedMonthlyPaymentCents)}/mo</span>}
            {result.estimatedPtiPct != null && <span>Est. PTI {result.estimatedPtiPct}%</span>}
          </div>
          {result.collateralStops.length > 0 && (
            <ul className="list-inside list-disc text-[var(--color-negative-text)]">
              {result.collateralStops.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          )}
          {result.applicantFlags.length > 0 && (
            <ul className="list-inside list-disc text-[var(--color-caution-text)]">
              {result.applicantFlags.map((f, i) => <li key={i}>{f.reason}</li>)}
            </ul>
          )}
          {result.exceptionNote && <p className="italic text-[var(--color-text)]">{result.exceptionNote}</p>}
          {result.cautions.length > 0 && (
            <ul className="list-inside list-disc text-[var(--color-text-muted)]">
              {result.cautions.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function VehicleRow({ dealId, row }: { dealId: string; row: VehicleMatchResult }) {
  const [isPending, startTransition] = useTransition();
  const best = row.programResults[0] ?? null;
  return (
    <div className="rounded-[var(--radius-panel)] border border-[var(--color-hairline)] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold text-[var(--color-text)]">{vehicleLabel(row.vehicle)}</div>
          <div className="text-[11.5px] text-[var(--color-text-muted)]">{formatCents(row.vehicle.askingPriceCents)}</div>
        </div>
        <div className="flex flex-none items-center gap-2">
          {best ? (
            <Badge tone={STATUS_TONE[best.status]}>
              {row.fitsCount > 0 ? `${row.fitsCount} lender${row.fitsCount === 1 ? "" : "s"} fit` : statusLabel(best)}
            </Badge>
          ) : (
            <Badge tone="neutral">No price on file</Badge>
          )}
          <Button
            type="button"
            variant="secondary"
            className="px-2 py-1 text-[11px]"
            disabled={isPending}
            onClick={() => startTransition(() => setDealVehicle(dealId, row.vehicle.id))}
          >
            Use this
          </Button>
        </div>
      </div>
      {best && best.lenderName && (
        <div className="mt-1 text-[11px] text-[var(--color-text-muted)]">
          Best fit: {best.lenderName}
          {best.estimatedMonthlyPaymentCents != null && ` · ${formatCents(best.estimatedMonthlyPaymentCents)}/mo`}
        </div>
      )}
    </div>
  );
}

export interface LenderVehicleMatchModalProps {
  dealId: string;
  customerName: string;
  vehicleLabel: string;
  creditFacts: CreditFacts;
  idType: string | null;
  wantBodyType: string | null;
  monthlyIncomeCents: number | null;
  incomeSource: string | null;
  cashDownCents: number | null;
  openAutoPaymentCents: number | null;
  amountFinancedCents: number | null;
  ltvPct: number | null;
  linkedVehicle: VehicleCandidate | null;
  programs: ProgramForMatch[];
  inventory: VehicleCandidate[];
  attentionNeeded: boolean;
}

export function LenderVehicleMatchModal({
  dealId,
  customerName,
  vehicleLabel: linkedVehicleLabel,
  creditFacts,
  idType,
  wantBodyType,
  monthlyIncomeCents,
  incomeSource,
  cashDownCents,
  openAutoPaymentCents,
  amountFinancedCents,
  ltvPct,
  linkedVehicle,
  programs,
  inventory,
  attentionNeeded,
}: LenderVehicleMatchModalProps) {
  const grade = gradeCredit(creditFacts);
  const hasScore = !!creditFacts.fico;
  const priorityLenders = idType && WESTLAKE_PRIORITY_ID_TYPES.has(idType) ? WESTLAKE_PRIORITY_LENDERS : undefined;

  const applicant = useMemo(
    () => ({
      creditScore: creditFacts.fico,
      monthlyIncomeCents,
      availableDownCents: cashDownCents ?? 0,
      openAutoPaymentCents,
    }),
    [creditFacts.fico, monthlyIncomeCents, cashDownCents, openAutoPaymentCents],
  );

  const lenderResults = useMemo(() => {
    if (!linkedVehicle || linkedVehicle.askingPriceCents == null) return null;
    return matchAllPrograms(
      { askingPriceCents: linkedVehicle.askingPriceCents, bookValueCents: linkedVehicle.bookValueCents, miles: linkedVehicle.miles, year: linkedVehicle.year, title: linkedVehicle.title },
      applicant,
      programs,
      priorityLenders,
    );
  }, [linkedVehicle, applicant, programs, priorityLenders]);

  const vehicleResults = useMemo(
    () => matchVehiclesForApplicant(inventory, applicant, programs, wantBodyType, priorityLenders),
    [inventory, applicant, programs, wantBodyType, priorityLenders],
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button">Lender & vehicle match</Button>
      </DialogTrigger>
      <DialogContent title={customerName} subtitle={linkedVehicleLabel || "Vehicle TBD"} className="max-w-3xl">
        {attentionNeeded && (
          <div className="mb-4 inline-flex items-center rounded-full bg-[var(--color-caution-bg)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[.03em] text-[var(--color-caution-text)]">
            Attention needed
          </div>
        )}

        <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] p-4 text-[12.5px] sm:grid-cols-3">
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">FICO / Grade</div>
            <div className="font-semibold text-[var(--color-text)]">{hasScore ? `${creditFacts.fico} · ${grade.grade}` : "No credit report"}</div>
          </div>
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">Verified income</div>
            <div className="font-semibold text-[var(--color-text)]">
              {monthlyIncomeCents != null ? `${formatCents(monthlyIncomeCents)}/mo` : "Unknown"}
              {incomeSource && <span className="ml-1 font-normal text-[var(--color-text-muted)]">({incomeSource})</span>}
            </div>
          </div>
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">Down payment</div>
            <div className="font-semibold text-[var(--color-text)]">{cashDownCents != null ? formatCents(cashDownCents) : "Unknown"}</div>
          </div>
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">Vehicle</div>
            <div className="font-semibold text-[var(--color-text)]">{linkedVehicle ? linkedVehicleLabel : "Not linked to inventory"}</div>
          </div>
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">Amount financed</div>
            <div className="font-semibold text-[var(--color-text)]">{amountFinancedCents != null ? formatCents(amountFinancedCents) : "Unknown"}</div>
          </div>
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">LTV / Identification</div>
            <div className="font-semibold text-[var(--color-text)]">
              {ltvPct != null ? `${ltvPct}%` : "—"} / {idType ?? "US ID"}
            </div>
          </div>
        </div>

        <Tabs defaultValue="lender">
          <TabsList>
            <TabsTrigger value="lender">Lender match</TabsTrigger>
            <TabsTrigger value="vehicle">Find vehicle</TabsTrigger>
          </TabsList>

          <TabsContent value="lender">
            {!linkedVehicle ? (
              <p className="py-4 text-[12.5px] text-[var(--color-text-muted)]">
                Link a vehicle (Customer, or the Find vehicle tab) to match it against lender guidelines.
              </p>
            ) : linkedVehicle.askingPriceCents == null ? (
              <p className="py-4 text-[12.5px] text-[var(--color-text-muted)]">This vehicle needs an asking price before it can be matched.</p>
            ) : !lenderResults || lenderResults.length === 0 ? (
              <p className="py-4 text-[12.5px] text-[var(--color-text-muted)]">No lender programs set up yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {lenderResults.map((r) => (
                  <LenderRow key={r.programId} result={r} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="vehicle">
            {vehicleResults.length === 0 ? (
              <p className="py-4 text-[12.5px] text-[var(--color-text-muted)]">
                {wantBodyType ? "Nothing in stock matches what they're looking for." : "No priced vehicles in stock yet."}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {vehicleResults.map((r) => (
                  <VehicleRow key={r.vehicle.id} dealId={dealId} row={r} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
