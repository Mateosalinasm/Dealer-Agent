"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { formatCents } from "@/lib/utils";
import { PTI_TARGETS, ptiCalc } from "@/lib/deal-facts";

function dollarsToCents(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[12.5px] text-[var(--color-text-muted)]">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function PtiCalculator() {
  const [income, setIncome] = useState("");
  const [price, setPrice] = useState("");
  const [pct, setPct] = useState(String(PTI_TARGETS[0]));
  const [aprPct, setAprPct] = useState("");
  const [term, setTerm] = useState("");
  const [existing, setExisting] = useState("0");
  const [down, setDown] = useState("");

  const pti = useMemo(
    () =>
      ptiCalc({
        income: dollarsToCents(income),
        price: dollarsToCents(price),
        pct: Number(pct) || PTI_TARGETS[0],
        apr: aprPct.trim() === "" ? null : Math.round(Number(aprPct) * 100),
        term: term.trim() === "" ? null : Number(term),
        existing: dollarsToCents(existing) ?? 0,
        down: dollarsToCents(down),
      }),
    [income, price, pct, aprPct, term, existing, down],
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
      <Card className="flex flex-col gap-4">
        <div>
          <div className="mb-1 text-[13.5px] font-semibold text-[var(--color-text)]">Income &amp; vehicle</div>
          <p className="text-[11.5px] text-[var(--color-text-muted)]">Same PTI math as a deal&apos;s own PTI calculator — this just isn&apos;t tied to a deal.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Monthly income</Label>
            <Input type="number" step="0.01" value={income} onChange={(e) => setIncome(e.target.value)} placeholder="3200" />
          </div>
          <div>
            <Label>Vehicle price</Label>
            <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="22995" />
          </div>
          <div>
            <Label>PTI target</Label>
            <Select value={pct} onChange={(e) => setPct(e.target.value)}>
              {PTI_TARGETS.map((t) => (
                <option key={t} value={t}>
                  {t}%
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Existing open-auto payment</Label>
            <Input type="number" step="0.01" value={existing} onChange={(e) => setExisting(e.target.value)} placeholder="0" />
          </div>
        </div>

        <div className="border-t border-[var(--color-hairline)] pt-4">
          <div className="mb-1 text-[13.5px] font-semibold text-[var(--color-text)]">Terms</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>APR %</Label>
              <Input type="number" step="0.01" value={aprPct} onChange={(e) => setAprPct(e.target.value)} placeholder="18.99" />
            </div>
            <div>
              <Label>Term (months)</Label>
              <Input type="number" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="60" />
            </div>
            <div>
              <Label>Down payment on file (optional)</Label>
              <Input type="number" step="0.01" value={down} onChange={(e) => setDown(e.target.value)} placeholder="Leave blank if unknown" />
            </div>
          </div>
        </div>
      </Card>

      <div className="lg:sticky lg:top-20 lg:self-start">
        <Card>
          {pti.blocked ? (
            <p className="text-[12.5px] text-[var(--color-text-muted)]">{pti.blocked}</p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">Down payment needed</div>
                <div className="mt-1 text-[24px] font-semibold tabular-nums tracking-[-.01em] text-[var(--color-text)]">{formatCents(pti.requiredDown!)}</div>
                {pti.down != null && (
                  <div className={`mt-1 text-[12.5px] ${pti.ok ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}`}>
                    {pti.ok ? "That down payment covers it." : `${formatCents(pti.shortfall!)} short of what you entered.`}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <Row label="Income used" value={`${formatCents(pti.income!)}/mo`} />
                <Row label={`${pti.pct}% of income`} value={`${formatCents(pti.allowed!)}/mo`} />
                <Row label="Existing open-auto payment" value={pti.existing ? `− ${formatCents(pti.existing)}/mo` : "none"} />
                <Row label="Room for this car payment" value={`${formatCents(pti.room!)}/mo`} />
                <Row label={`That finances, at ${pti.apr! / 100}% over ${pti.term} months`} value={formatCents(pti.maxFinanced!)} />
                <Row label="Vehicle price" value={formatCents(pti.price!)} />
                <Row label="Down payment needed" value={formatCents(pti.requiredDown!)} />
                {pti.actualPayment != null && <Row label="Payment at the down payment you entered" value={`${formatCents(pti.actualPayment)}/mo`} />}
                {pti.actualPti != null && <Row label="Resulting PTI" value={`${pti.actualPti}%`} />}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
