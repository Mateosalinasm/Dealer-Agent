"use client";

import { useState, useTransition } from "react";
import { toggleDealStep } from "@/app/desk/deals/actions";
import { STAGES } from "@/lib/deal-stage";
import { cn } from "@/lib/utils";

export function StageChecklist({ dealId, done }: { dealId: string; done: Record<string, boolean> }) {
  const [localDone, setLocalDone] = useState(done);
  const [syncedDone, setSyncedDone] = useState(done);
  const [, startTransition] = useTransition();

  if (done !== syncedDone) {
    setSyncedDone(done);
    setLocalDone(done);
  }

  function toggle(stepId: string) {
    setLocalDone((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
    startTransition(() => toggleDealStep(dealId, stepId));
  }

  return (
    <div className="flex flex-col gap-4">
      {STAGES.map((stage) => {
        const doneCount = stage.steps.filter((s) => localDone[s.id]).length;
        return (
          <div key={stage.name}>
            <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
              {stage.name}
              <span className="tabular-nums opacity-70">
                {doneCount}/{stage.steps.length}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {stage.steps.map((step) => (
                <label
                  key={step.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-panel)] px-2 py-1.5 hover:bg-[var(--color-fill-subtle)]"
                >
                  <input
                    type="checkbox"
                    checked={!!localDone[step.id]}
                    onChange={() => toggle(step.id)}
                    className="h-4 w-4 rounded accent-[var(--color-primary)]"
                  />
                  <span className={cn("text-[13px] text-[var(--color-text)]", localDone[step.id] && "text-[var(--color-text-muted)] line-through")}>
                    {step.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
