"use client";

import { useState, useTransition } from "react";
import { toggleDealStep, toggleStip } from "@/app/desk/deals/actions";
import { STAGES } from "@/lib/deal-stage";
import { cn } from "@/lib/utils";

type Stip = { label: string; done: boolean };

// The full Application/Approval/Funding checklist, with the deal's stips
// itemized inside the Funding stage's "Collect stips & insurance" step
// instead of living as a separate list — that step checks itself off once
// every stip below it is done. Each stage also gets its own "Check all"
// that only touches steps (and, for Funding, stips) in that stage.
export function StageChecklist({ dealId, done, stips }: { dealId: string; done: Record<string, boolean>; stips: Stip[] }) {
  const [localDone, setLocalDone] = useState(done);
  const [syncedDone, setSyncedDone] = useState(done);
  const [localStips, setLocalStips] = useState(stips);
  const [syncedStips, setSyncedStips] = useState(stips);
  const [, startTransition] = useTransition();

  if (done !== syncedDone) {
    setSyncedDone(done);
    setLocalDone(done);
  }
  if (stips !== syncedStips) {
    setSyncedStips(stips);
    setLocalStips(stips);
  }

  function toggle(stepId: string) {
    setLocalDone((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
    startTransition(() => toggleDealStep(dealId, stepId));
  }

  function toggleStipRow(i: number) {
    const nowDone = !localStips[i].done;
    setLocalStips((prev) => prev.map((s, idx) => (idx === i ? { ...s, done: nowDone } : s)));
    startTransition(() => toggleStip(dealId, i));
  }

  function checkAll(stageName: string, steps: { id: string; label: string }[]) {
    startTransition(async () => {
      for (const step of steps) {
        if (step.id === "stips" || localDone[step.id]) continue;
        setLocalDone((prev) => ({ ...prev, [step.id]: true }));
        await toggleDealStep(dealId, step.id);
      }
      if (stageName === "Funding") {
        for (let i = 0; i < localStips.length; i++) {
          if (localStips[i].done) continue;
          setLocalStips((prev) => prev.map((s, idx) => (idx === i ? { ...s, done: true } : s)));
          await toggleStip(dealId, i);
        }
      }
    });
  }

  const stipsDone = localStips.filter((s) => s.done).length;

  return (
    <div className="flex flex-col gap-4">
      {STAGES.map((stage) => {
        const doneCount = stage.steps.filter((s) => localDone[s.id]).length;
        const allDone = doneCount === stage.steps.length && (stage.name !== "Funding" || stipsDone === localStips.length);
        return (
          <div key={stage.name}>
            <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
              {stage.name}
              <span className="tabular-nums opacity-70">
                {doneCount}/{stage.steps.length}
              </span>
              <button
                type="button"
                onClick={() => checkAll(stage.name, stage.steps)}
                disabled={allDone}
                className="ml-auto rounded-[var(--radius-pill)] px-2 py-0.5 text-[10.5px] font-semibold normal-case tracking-normal text-[var(--color-primary)] hover:bg-[var(--color-info-bg)] disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
              >
                Check all
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {stage.steps.map((step) =>
                step.id === "stips" ? (
                  <div key={step.id} className="rounded-[var(--radius-panel)] px-2 py-1.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "h-4 w-4 flex-none rounded-[4px] border-2",
                          localDone.stips ? "border-[var(--color-primary)] bg-[var(--color-primary)]" : "border-[var(--color-hairline)]",
                        )}
                      />
                      <span className={cn("text-[13px] text-[var(--color-text)]", localDone.stips && "text-[var(--color-text-muted)] line-through")}>
                        {step.label}
                      </span>
                      <span className="ml-auto tabular-nums text-[11px] text-[var(--color-text-muted)]">
                        {stipsDone}/{localStips.length}
                      </span>
                    </div>
                    <div className="ml-6 mt-1 flex flex-col gap-0.5">
                      {localStips.map((stip, i) => (
                        <label
                          key={`${stip.label}-${i}`}
                          className="flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-panel)] px-2 py-1 hover:bg-[var(--color-fill-subtle)]"
                        >
                          <input
                            type="checkbox"
                            checked={stip.done}
                            onChange={() => toggleStipRow(i)}
                            className="h-3.5 w-3.5 rounded accent-[var(--color-primary)]"
                          />
                          <span className={cn("text-[12.5px] text-[var(--color-text)]", stip.done && "text-[var(--color-text-muted)] line-through")}>
                            {stip.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
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
                ),
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
