"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { AccordionSection } from "@/components/accordion-section";
import { toggleDealStep, toggleStip } from "@/app/desk/deals/actions";
import { STAGES } from "@/lib/deal-stage";
import { cn } from "@/lib/utils";

type Stip = { label: string; done: boolean };

function StageBadge({ index, state }: { index: number; state: "done" | "current" | "upcoming" }) {
  if (state === "done") {
    return (
      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[var(--color-positive)] text-white">
        <Check size={13} strokeWidth={3} />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flex h-6 w-6 flex-none items-center justify-center rounded-full text-[12px] font-bold",
        state === "current" ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-fill-subtle)] text-[var(--color-text-muted)]",
      )}
    >
      {index + 1}
    </span>
  );
}

function CheckAllButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <div className="mt-1.5 flex justify-end">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-fill-subtle)] disabled:cursor-default disabled:opacity-40 disabled:hover:bg-[var(--color-surface)]"
      >
        Check all
      </button>
    </div>
  );
}

function StepRow({ label, done, onToggle }: { label: string; done: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-2.5 rounded-[var(--radius-panel)] px-2 py-1.5 text-left transition-colors hover:bg-[var(--color-fill-subtle)]"
    >
      <span
        className={cn(
          "flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 transition-colors",
          done ? "border-[var(--color-positive)] bg-[var(--color-positive)]" : "border-[var(--color-hairline)]",
        )}
      >
        {done && <Check size={12} strokeWidth={3} className="text-white" />}
      </span>
      <span className={cn("text-[13px] text-[var(--color-text)]", done && "text-[var(--color-text-muted)] line-through")}>{label}</span>
    </button>
  );
}

// The full Application/Approval/Funding checklist — one AccordionSection per
// stage (numbered badge, "Next: <step>" summary, x/y count, its own
// collapse), matching the reference design. The deal's stips stay itemized
// inside the Funding stage's "Collect stips & insurance" step rather than
// living as a separate list — that step checks itself off once every stip
// below it is done. Each stage gets its own "Check all" that only touches
// steps (and, for Funding, stips) in that stage.
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

  // The first stage with an incomplete step is "current" — every stage
  // before it is done, every stage after it hasn't been started, since a
  // deal only ever moves forward through these in order.
  const currentStageIdx = STAGES.findIndex((stage) => stage.steps.some((s) => !localDone[s.id]));

  return (
    <>
      {STAGES.map((stage, stageIdx) => {
        const doneCount = stage.steps.filter((s) => localDone[s.id]).length;
        const stageAllDone = doneCount === stage.steps.length && (stage.name !== "Funding" || stipsDone === localStips.length);
        const nextStep = stage.steps.find((s) => !localDone[s.id]);
        const badgeState = currentStageIdx === -1 || stageIdx < currentStageIdx ? "done" : stageIdx === currentStageIdx ? "current" : "upcoming";

        return (
          <AccordionSection
            key={stage.name}
            title={stage.name}
            summary={nextStep ? `Next: ${nextStep.label}` : undefined}
            badge={<StageBadge index={stageIdx} state={badgeState} />}
            trailing={
              <span className="ml-1 flex-none tabular-nums text-[12px] text-[var(--color-text-muted)]">
                {doneCount}/{stage.steps.length}
              </span>
            }
            defaultOpen={badgeState !== "done"}
          >
            <div className="flex flex-col gap-0.5">
              {stage.steps.map((step) =>
                step.id === "stips" ? (
                  <div key={step.id} className="rounded-[var(--radius-panel)] px-2 py-1">
                    <StepRow label={step.label} done={!!localDone.stips} onToggle={() => toggle(step.id)} />
                    <div className="ml-8 mt-0.5 flex flex-col gap-0.5">
                      {localStips.map((stip, i) => (
                        <StepRow key={`${stip.label}-${i}`} label={stip.label} done={stip.done} onToggle={() => toggleStipRow(i)} />
                      ))}
                      {localStips.length > 0 && (
                        <div className="px-2 text-[11px] text-[var(--color-text-muted)]">
                          {stipsDone}/{localStips.length} stips cleared
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <StepRow key={step.id} label={step.label} done={!!localDone[step.id]} onToggle={() => toggle(step.id)} />
                ),
              )}
            </div>
            <CheckAllButton onClick={() => checkAll(stage.name, stage.steps)} disabled={stageAllDone} />
          </AccordionSection>
        );
      })}
    </>
  );
}
