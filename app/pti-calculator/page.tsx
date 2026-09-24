import { PtiCalculator } from "@/components/pti-calculator";

export default function PtiCalculatorPage() {
  return (
    <div>
      <h1 className="mb-1 text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">PTI calculator</h1>
      <p className="mb-5 text-[12.5px] text-[var(--color-text-muted)]">
        Same payment-to-income math as a deal&apos;s own PTI calculator, for a quick estimate before there&apos;s a deal
        to attach it to.
      </p>
      <PtiCalculator />
    </div>
  );
}
