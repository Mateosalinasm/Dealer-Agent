import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/utils";
import { toggleOpenAutoTradeIn, updatePti } from "@/app/desk/deals/actions";
import { PTI_TARGETS, type DealFacts, type PtiResult } from "@/lib/deal-facts";

export function PtiSection({
  dealId,
  facts,
  pti,
  ptiPriceOverride,
  openAutoTradeIn,
}: {
  dealId: string;
  facts: DealFacts;
  pti: PtiResult;
  ptiPriceOverride: number | null;
  openAutoTradeIn: boolean;
}) {
  if (pti.blocked) {
    return <p className="text-[12.5px] text-[var(--color-text-muted)]">{pti.blocked}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">Down payment needed</div>
        <div className="mt-1 text-[24px] font-semibold tabular-nums tracking-[-.01em] text-[var(--color-text)]">{formatCents(pti.requiredDown!)}</div>
        {pti.down != null && (
          <div className={`mt-1 text-[12.5px] ${pti.ok ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}`}>
            {pti.ok ? "Current down payment covers it." : `${formatCents(pti.shortfall!)} short of what's on file.`}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1 text-[12.5px]">
        <Row label="Income used for this deal" value={`${formatCents(pti.income!)}/mo`} />
        <Row label={`${pti.pct}% of income`} value={`${formatCents(pti.allowed!)}/mo`} />
        <div className="flex items-center justify-between text-[var(--color-text-muted)]">
          <span>{openAutoTradeIn ? "Open auto payment (being traded in)" : "Open auto payment already committed"}</span>
          <div className="flex items-center gap-2">
            <span className="tabular-nums">{openAutoTradeIn ? "not counted" : pti.existing ? `− ${formatCents(pti.existing)}/mo` : "none"}</span>
            <form action={toggleOpenAutoTradeIn.bind(null, dealId)}>
              <button type="submit" className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline">
                {openAutoTradeIn ? "Not trading in" : "Trading in"}
              </button>
            </form>
          </div>
        </div>
        <Row label="Room for this car payment" value={`${formatCents(pti.room!)}/mo`} />
        <Row label={`That finances, at ${pti.apr! / 100}% over ${pti.term} months`} value={formatCents(pti.maxFinanced!)} />
        <Row label="Vehicle price" value={formatCents(pti.price!)} />
        <Row label="Down payment needed" value={formatCents(pti.requiredDown!)} />
      </div>

      <form action={updatePti.bind(null, dealId)} className="flex flex-wrap items-end gap-3">
        <div>
          <Label>PTI target</Label>
          <Select name="ptiPct" defaultValue={String(pti.pct)}>
            {PTI_TARGETS.map((t) => (
              <option key={t} value={t}>
                {t}%
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Vehicle price override</Label>
          <Input name="ptiPriceDollars" type="number" step="0.01" defaultValue={ptiPriceOverride != null ? ptiPriceOverride / 100 : ""} placeholder={facts.sellPrice != null ? String(facts.sellPrice / 100) : ""} />
        </div>
        <Button type="submit" variant="secondary">
          Save
        </Button>
      </form>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[var(--color-text-muted)]">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
