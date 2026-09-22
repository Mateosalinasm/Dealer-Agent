"use client";

import { useState, useTransition } from "react";
import { toggleDealStep } from "@/app/desk/deals/actions";
import type { StageStep } from "@/lib/deal-stage";

// The "Also remaining" preview on a board card — same checklist as the
// deal's Stage checklist accordion, but checkable right from the board so
// a quick step doesn't require opening the deal. Sits outside any Link, so
// no click-propagation concerns.
export function BoardChecklistPreview({
  dealId,
  remaining,
}: {
  dealId: string;
  remaining: { step: StageStep; stage: number }[];
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  function toggle(stepId: string) {
    setChecked((prev) => ({ ...prev, [stepId]: true }));
    startTransition(() => toggleDealStep(dealId, stepId));
  }

  const visible = remaining.filter((r) => !checked[r.step.id]).slice(0, 2);
  if (visible.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-1 border-t border-white/10 pt-2">
      <div className="text-[9.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">Also remaining</div>
      {visible.map((r, i) => (
        <label
          key={r.step.id}
          className="flex cursor-pointer items-center gap-2 text-[11.5px] text-white/80 hover:text-white"
        >
          <input
            type="checkbox"
            onChange={() => toggle(r.step.id)}
            className={`h-3 w-3 flex-none rounded-full border ${i === 0 ? "border-[var(--color-primary)] accent-[var(--color-primary)]" : "border-white/30 accent-white/60"}`}
          />
          {r.step.label}
        </label>
      ))}
    </div>
  );
}
