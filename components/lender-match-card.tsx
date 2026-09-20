"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { formatCents } from "@/lib/utils";
import {
  matchAllPrograms,
  type ApplicantForMatch,
  type ExceptionLikelihood,
  type ProgramForMatch,
  type VehicleForMatch,
} from "@/lib/lender-match";

const LIKELIHOOD_LABEL: Record<ExceptionLikelihood, string> = {
  strong: "Flagged — worth a call",
  possible: "Flagged — worth asking",
  unlikely: "Flagged — long shot",
};

interface VehicleOption {
  id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  askingPrice: number | null;
  bookValue: number | null;
  miles: number | null;
  title: VehicleForMatch["title"];
}

interface LenderMatchCardProps {
  vehicle: VehicleOption | null;
  programs: ProgramForMatch[];
  snapshot: {
    creditScore: number | null;
    creditScoreSource: string | null;
    monthlyIncomeCents: number | null;
    incomeSource: string | null;
  };
  availableDownCents: number | null;
}

// Locked to the deal's actual vehicle (set in the Customer section) — see
// Deal Desk v2.dc.html's "Lenders" section, which matches lenders against
// the deal you're actually working, not a hypothetical unit.
export function LenderMatchCard({ vehicle, programs, snapshot, availableDownCents }: LenderMatchCardProps) {
  const [creditScore, setCreditScore] = useState(snapshot.creditScore?.toString() ?? "");
  const [monthlyIncome, setMonthlyIncome] = useState(
    snapshot.monthlyIncomeCents != null ? (snapshot.monthlyIncomeCents / 100).toString() : "",
  );
  const [availableDown, setAvailableDown] = useState(availableDownCents != null ? (availableDownCents / 100).toString() : "0");

  const results = useMemo(() => {
    if (!vehicle || !vehicle.askingPrice) return null;
    const applicant: ApplicantForMatch = {
      creditScore: creditScore ? Number(creditScore) : null,
      monthlyIncomeCents: monthlyIncome ? Math.round(Number(monthlyIncome) * 100) : null,
      availableDownCents: availableDown ? Math.round(Number(availableDown) * 100) : 0,
    };
    const vehicleInput: VehicleForMatch = {
      askingPriceCents: vehicle.askingPrice,
      bookValueCents: vehicle.bookValue,
      miles: vehicle.miles,
      year: vehicle.year,
      title: vehicle.title,
    };
    return matchAllPrograms(vehicleInput, applicant, programs);
  }, [vehicle, creditScore, monthlyIncome, availableDown, programs]);

  return (
    <Card>
      <div className="mb-1 text-[13.5px] font-semibold text-[var(--color-text)]">Lenders</div>
      <p className="mb-3 text-[11px] text-[var(--color-text-muted)]">
        Computed from your lender guidelines against this deal&rsquo;s vehicle — not AI, not a quote.
      </p>

      {!vehicle ? (
        <p className="text-[12.5px] text-[var(--color-text-muted)]">Pick a vehicle in Customer to see lender matches.</p>
      ) : (
        <div className="mb-3 text-[12.5px] font-semibold text-[var(--color-text)]">
          {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim ?? ""}
        </div>
      )}

      {vehicle && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="lm-credit">
              Credit score {snapshot.creditScoreSource && <span className="normal-case text-[var(--color-text-muted)]">({snapshot.creditScoreSource})</span>}
            </Label>
            <Input id="lm-credit" type="number" value={creditScore} onChange={(e) => setCreditScore(e.target.value)} placeholder="Unknown" />
          </div>
          <div>
            <Label htmlFor="lm-income">
              Monthly income {snapshot.incomeSource && <span className="normal-case text-[var(--color-text-muted)]">({snapshot.incomeSource})</span>}
            </Label>
            <Input id="lm-income" type="number" step="0.01" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} placeholder="Unknown" />
          </div>
          <div>
            <Label htmlFor="lm-down">Down available</Label>
            <Input id="lm-down" type="number" step="0.01" value={availableDown} onChange={(e) => setAvailableDown(e.target.value)} />
          </div>
        </div>
      )}

      {!vehicle ? null : !results ? (
        <p className="mt-4 text-[12.5px] text-[var(--color-text-muted)]">This vehicle needs an asking price before it can be matched.</p>
      ) : results.length === 0 ? (
        <p className="mt-4 text-[12.5px] text-[var(--color-text-muted)]">No lender programs set up yet.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {results.map((r) => (
            <div key={r.programId} className="rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] p-3">
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-semibold text-[var(--color-text)]">
                  {r.lenderName} <span className="font-normal text-[var(--color-text-muted)]">· {r.programLabel}</span>
                </div>
                <Badge
                  tone={r.status === "fits" ? "positive" : r.status === "flagged" ? "caution" : "negative"}
                >
                  {r.status === "fits" ? "Fits" : r.status === "excluded" ? "Doesn't fit" : LIKELIHOOD_LABEL[r.exceptionLikelihood!]}
                </Badge>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11.5px] text-[var(--color-text-muted)]">
                <span>Max advance {formatCents(r.maxAdvanceCents)}</span>
                <span>Required down {formatCents(r.requiredDownCents)}</span>
                {r.estimatedMonthlyPaymentCents != null && (
                  <span>Est. payment {formatCents(r.estimatedMonthlyPaymentCents)}/mo</span>
                )}
                {r.estimatedPtiPct != null && <span>Est. PTI {r.estimatedPtiPct}%</span>}
              </div>

              {r.status === "excluded" && r.collateralStops.length > 0 && (
                <ul className="mt-1.5 list-inside list-disc text-[11px] text-[var(--color-negative-text)]">
                  {r.collateralStops.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}

              {r.status === "flagged" && (
                <div className="mt-1.5">
                  <ul className="list-inside list-disc text-[11px] text-[var(--color-caution-text)]">
                    {r.applicantFlags.map((f, i) => (
                      <li key={i}>{f.reason}</li>
                    ))}
                  </ul>
                  {r.exceptionNote && (
                    <p className="mt-1 text-[11.5px] italic text-[var(--color-text)]">{r.exceptionNote}</p>
                  )}
                </div>
              )}

              {r.cautions.length > 0 && (
                <ul className="mt-1 list-inside list-disc text-[11px] text-[var(--color-text-muted)]">
                  {r.cautions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
