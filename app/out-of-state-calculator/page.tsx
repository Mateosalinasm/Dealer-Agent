import { OutOfStateCalculator } from "@/components/out-of-state-calculator";

export default function OutOfStateCalculatorPage() {
  return (
    <div>
      <h1 className="mb-1 text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">Out-of-state calculator</h1>
      <p className="mb-5 text-[12.5px] text-[var(--color-text-muted)]">
        Louisiana taxes &amp; ATC titling fees for an out-of-state deal — the formula and default fees are taken
        directly from real ATC quotes, not estimated.
      </p>
      <OutOfStateCalculator />
    </div>
  );
}
