"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { formatCents } from "@/lib/utils";
import { calculateLouisianaOutOfState, LOUISIANA_DEFAULTS, LOUISIANA_PARISH_PRESETS } from "@/lib/louisiana-out-of-state-tax";

const OTHER_PARISH = "__other__";

function dollarsToCents(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function centsToDollarString(cents: number): string {
  return (cents / 100).toFixed(2);
}

function MoneyField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type="number" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="mt-1 text-[10.5px] text-[var(--color-text-muted)]">{hint}</p>}
    </div>
  );
}

function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${emphasis ? "text-[14px] font-semibold text-[var(--color-text)]" : "text-[12.5px] text-[var(--color-text-muted)]"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function OutOfStateCalculator() {
  const [parish, setParish] = useState<string>(LOUISIANA_PARISH_PRESETS[0].name);
  const [customParishRate, setCustomParishRate] = useState("4.00");
  const [stateRatePct, setStateRatePct] = useState(String(LOUISIANA_DEFAULTS.stateRatePct));

  const [basePrice, setBasePrice] = useState("");
  const [deliveryFees, setDeliveryFees] = useState("0");
  const [dealerServiceFee, setDealerServiceFee] = useState("0");
  const [theftProtection, setTheftProtection] = useState("0");
  const [additions, setAdditions] = useState("0");
  const [protectionPackages, setProtectionPackages] = useState("0");
  const [manufacturerRebate, setManufacturerRebate] = useState("0");
  const [tradeInAmount, setTradeInAmount] = useState("0");

  const [localHandlingFee, setLocalHandlingFee] = useState(centsToDollarString(LOUISIANA_DEFAULTS.localHandlingFeeCents));
  const [registrationFee, setRegistrationFee] = useState(centsToDollarString(LOUISIANA_DEFAULTS.registrationFeeCents));
  const [titleFees, setTitleFees] = useState(centsToDollarString(LOUISIANA_DEFAULTS.titleFeesCents));
  const [atcServiceFee, setAtcServiceFee] = useState(centsToDollarString(LOUISIANA_DEFAULTS.atcServiceFeeCents));
  const [mailingExpense, setMailingExpense] = useState(centsToDollarString(LOUISIANA_DEFAULTS.mailingExpenseCents));

  const parishRatePct =
    parish === OTHER_PARISH ? Number(customParishRate) || 0 : (LOUISIANA_PARISH_PRESETS.find((p) => p.name === parish)?.ratePct ?? 0);

  const result = useMemo(
    () =>
      calculateLouisianaOutOfState({
        basePriceCents: dollarsToCents(basePrice),
        deliveryFeesCents: dollarsToCents(deliveryFees),
        dealerServiceFeeCents: dollarsToCents(dealerServiceFee),
        theftProtectionCents: dollarsToCents(theftProtection),
        additionsCents: dollarsToCents(additions),
        protectionPackagesCents: dollarsToCents(protectionPackages),
        manufacturerRebateCents: dollarsToCents(manufacturerRebate),
        tradeInAmountCents: dollarsToCents(tradeInAmount),
        stateRatePct: Number(stateRatePct) || 0,
        parishRatePct,
        localHandlingFeeCents: dollarsToCents(localHandlingFee),
        registrationFeeCents: dollarsToCents(registrationFee),
        titleFeesCents: dollarsToCents(titleFees),
        atcServiceFeeCents: dollarsToCents(atcServiceFee),
        mailingExpenseCents: dollarsToCents(mailingExpense),
      }),
    [
      basePrice,
      deliveryFees,
      dealerServiceFee,
      theftProtection,
      additions,
      protectionPackages,
      manufacturerRebate,
      tradeInAmount,
      stateRatePct,
      parishRatePct,
      localHandlingFee,
      registrationFee,
      titleFees,
      atcServiceFee,
      mailingExpense,
    ],
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
      <Card className="flex flex-col gap-4">
        <div>
          <div className="mb-1 text-[13.5px] font-semibold text-[var(--color-text)]">Vehicle price &amp; add-ons</div>
          <p className="text-[11.5px] text-[var(--color-text-muted)]">
            Taxable value = base price + delivery + dealer service fee + theft protection + additions + protection packages − manufacturer rebate − trade-in.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MoneyField label="Base price" value={basePrice} onChange={setBasePrice} />
          <MoneyField label="Delivery fees" value={deliveryFees} onChange={setDeliveryFees} />
          <MoneyField label="Dealer service fee" value={dealerServiceFee} onChange={setDealerServiceFee} />
          <MoneyField label="Theft protection" value={theftProtection} onChange={setTheftProtection} />
          <MoneyField label="Additions" value={additions} onChange={setAdditions} />
          <MoneyField label="Protection packages" value={protectionPackages} onChange={setProtectionPackages} />
          <MoneyField label="Manufacturer rebate" value={manufacturerRebate} onChange={setManufacturerRebate} />
          <MoneyField label="Trade-in amount" value={tradeInAmount} onChange={setTradeInAmount} />
        </div>

        <div className="border-t border-[var(--color-hairline)] pt-4">
          <div className="mb-1 text-[13.5px] font-semibold text-[var(--color-text)]">Tax rates</div>
          <p className="mb-3 text-[11.5px] text-[var(--color-text-muted)]">
            State rate and Lafayette/Jefferson parish rates are confirmed from real ATC quotes. Any other parish needs
            its real rate looked up — this never guesses one.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Parish</Label>
              <Select value={parish} onChange={(e) => setParish(e.target.value)}>
                {LOUISIANA_PARISH_PRESETS.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} ({p.ratePct.toFixed(2)}%)
                  </option>
                ))}
                <option value={OTHER_PARISH}>Other parish — enter rate</option>
              </Select>
            </div>
            {parish === OTHER_PARISH ? (
              <div>
                <Label>Parish tax rate %</Label>
                <Input type="number" step="0.0001" value={customParishRate} onChange={(e) => setCustomParishRate(e.target.value)} />
              </div>
            ) : (
              <div>
                <Label>Parish tax rate %</Label>
                <Input type="number" step="0.0001" value={parishRatePct.toFixed(2)} disabled />
              </div>
            )}
            <div>
              <Label>State tax rate %</Label>
              <Input type="number" step="0.0001" value={stateRatePct} onChange={(e) => setStateRatePct(e.target.value)} />
              <p className="mt-1 text-[10.5px] text-[var(--color-text-muted)]">5.00% on both reference quotes — edit if LA changes it.</p>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--color-hairline)] pt-4">
          <div className="mb-1 text-[13.5px] font-semibold text-[var(--color-text)]">Flat fees</div>
          <p className="mb-3 text-[11.5px] text-[var(--color-text-muted)]">
            Defaults are what ATC actually charged on both reference deals. Registration is GVWR-based — double-check
            it for anything heavier than a normal passenger vehicle.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <MoneyField label="Local handling fee" value={localHandlingFee} onChange={setLocalHandlingFee} />
            <MoneyField label="Registration fee" value={registrationFee} onChange={setRegistrationFee} hint="GVWR-based — verify for this vehicle." />
            <MoneyField label="Title fees" value={titleFees} onChange={setTitleFees} hint="Title fee + lien fee combined." />
            <MoneyField label="ATC service fee" value={atcServiceFee} onChange={setAtcServiceFee} />
            <MoneyField label="Mailing expense" value={mailingExpense} onChange={setMailingExpense} />
          </div>
        </div>
      </Card>

      <div className="lg:sticky lg:top-20 lg:self-start">
        <Card>
          <div className="mb-3 text-[13.5px] font-semibold text-[var(--color-text)]">Fee breakdown</div>
          <div className="flex flex-col gap-2">
            <Row label="Taxable value" value={formatCents(result.taxableValueCents)} />
            <Row label={`State tax (${(Number(stateRatePct) || 0).toFixed(2)}%)`} value={formatCents(result.stateTaxCents)} />
            <Row label={`Parish tax (${parishRatePct.toFixed(2)}%)`} value={formatCents(result.parishTaxCents)} />
            <div className="rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] px-3 py-2">
              <Row label="Tax sub-total" value={formatCents(result.taxSubtotalCents)} emphasis />
            </div>
            <Row label="Local handling fee" value={formatCents(dollarsToCents(localHandlingFee))} />
            <Row label="Registration fee" value={formatCents(dollarsToCents(registrationFee))} />
            <Row label="Title fees" value={formatCents(dollarsToCents(titleFees))} />
            <Row label="ATC service fee" value={formatCents(dollarsToCents(atcServiceFee))} />
            <Row label="Mailing expense" value={formatCents(dollarsToCents(mailingExpense))} />
          </div>
          <div className="mt-4 border-t border-[var(--color-hairline)] pt-3">
            <div className="text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">Total due</div>
            <div className="mt-1 text-[24px] font-semibold tabular-nums tracking-[-.01em] text-[var(--color-text)]">{formatCents(result.totalDueCents)}</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
