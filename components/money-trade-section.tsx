import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/utils";
import { updateMoneyTrade } from "@/app/desk/deals/actions";
import type { DealFacts } from "@/lib/deal-facts";

const dollarsOrEmpty = (cents: number | null) => (cents != null ? cents / 100 : "");

export function MoneyTradeSection({
  dealId,
  facts,
  tradeVehicle,
}: {
  dealId: string;
  facts: DealFacts;
  tradeVehicle: string | null;
}) {
  const tradeEquityTone =
    facts.tradeEquity == null ? "text-[var(--color-text-muted)]" : facts.tradeEquity < 0 ? "text-[var(--color-negative)]" : "text-[var(--color-positive)]";

  return (
    <form action={updateMoneyTrade.bind(null, dealId)} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Selling price</Label>
          <Input name="salePriceDollars" type="number" step="0.01" defaultValue={dollarsOrEmpty(facts.sellPrice)} />
        </div>
        <div>
          <Label>Doc fee</Label>
          <Input name="docFeeDollars" type="number" step="0.01" defaultValue={dollarsOrEmpty(facts.docFee)} />
        </div>
        <div>
          <Label>Sales tax</Label>
          <Input name="salesTaxDollars" type="number" step="0.01" defaultValue={dollarsOrEmpty(facts.taxAmt)} />
        </div>
        <div>
          <Label>Service contract</Label>
          <Input name="warrantyDollars" type="number" step="0.01" defaultValue={dollarsOrEmpty(facts.warranty)} />
        </div>
        <div>
          <Label>GAP</Label>
          <Input name="gapInsDollars" type="number" step="0.01" defaultValue={dollarsOrEmpty(facts.gapIns)} />
        </div>
        <div>
          <Label>What the products cost us</Label>
          <Input name="backEndCostDollars" type="number" step="0.01" defaultValue={dollarsOrEmpty(facts.backEndCost)} />
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[12px] font-semibold text-[var(--color-text)]">Trade-in</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Trade vehicle</Label>
            <Input name="tradeVehicle" defaultValue={tradeVehicle ?? ""} placeholder="2018 Honda Civic" />
          </div>
          <div>
            <Label>ACV</Label>
            <Input name="tradeAcvDollars" type="number" step="0.01" defaultValue={dollarsOrEmpty(facts.tradeAcv)} />
          </div>
          <div>
            <Label>Payoff</Label>
            <Input name="tradePayoffDollars" type="number" step="0.01" defaultValue={dollarsOrEmpty(facts.tradePayoff)} />
          </div>
        </div>
        <div className={`mt-2 text-[13px] font-semibold ${tradeEquityTone}`}>
          Trade equity: {facts.tradeEquity == null ? "—" : formatCents(facts.tradeEquity)}
        </div>
        <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
          {facts.tradeEquity == null
            ? "Enter an ACV and a payoff to see the equity."
            : facts.tradeEquity < 0
              ? "Negative equity, rolled into the amount financed."
              : "Positive equity, working like extra money down."}
        </p>
      </div>

      <div className="flex flex-col gap-1 rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] p-3 text-[12.5px]">
        <Row label="Selling price" value={formatCents(facts.sellPrice)} />
        <Row label="Doc fee, tax and products" value={facts.addOns ? `+ ${formatCents(facts.addOns)}` : "none"} />
        <Row label="Cash down" value={facts.down != null ? `− ${formatCents(facts.down)}` : "none"} />
        <Row
          label="Trade equity"
          value={facts.tradeEquity == null ? "no trade" : facts.tradeEquity < 0 ? `+ ${formatCents(Math.abs(facts.tradeEquity))} rolled in` : `− ${formatCents(facts.tradeEquity)}`}
        />
        <Row label="Amount financed" value={formatCents(facts.amountFinanced)} strong />
      </div>

      <div className="flex flex-col gap-1 rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] p-3 text-[12.5px]">
        <Row label="Front gross" value={facts.frontGross == null ? "needs the unit cost" : formatCents(facts.frontGross)} />
        <Row label="Back-end gross" value={facts.backGross == null ? "no products sold" : formatCents(facts.backGross)} />
        <Row label="Total gross" value={formatCents(facts.totalGross)} strong />
      </div>

      <Button type="submit" className="self-end">
        Save
      </Button>
    </form>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? "font-semibold text-[var(--color-text)]" : "text-[var(--color-text-muted)]"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
