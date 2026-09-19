// The Application/Approval/Funding checklist from the design prototype
// (Deal Desk v2.dc.html, STAGES at line ~3181). A deal's pipeline
// position is always derived from `done`, never stored separately —
// see schema-sketch/schema.ts for why `funded`/`fundedOn` still exist
// alongside it.

export interface StageStep {
  id: string;
  label: string;
}

export interface Stage {
  name: string;
  steps: StageStep[];
}

export const STAGES: Stage[] = [
  {
    name: "Application",
    steps: [
      { id: "credit", label: "Pull credit" },
      { id: "income", label: "Verify income (Turbopass)" },
      { id: "structure", label: "Structure the deal" },
      { id: "submit", label: "Submit to lenders" },
    ],
  },
  {
    name: "Approval",
    steps: [
      { id: "approval", label: "Get approval back" },
      { id: "present", label: "Present numbers to customer" },
      { id: "signoff", label: "Customer signs off on numbers" },
      { id: "contracts", label: "Sign premium contract" },
    ],
  },
  {
    name: "Funding",
    steps: [
      { id: "stips", label: "Collect stips & insurance" },
      { id: "plates", label: "Assign plates" },
      { id: "bank", label: "Contract with the bank" },
      { id: "booked", label: "Booked" },
      { id: "funded", label: "Funded" },
    ],
  },
];

const ALL_STEPS = STAGES.flatMap((s) => s.steps);

export interface DealStageInfo {
  /** Index of the first stage with an incomplete step, or 3 if every step is done. */
  stageIdx: number;
  doneCount: number;
  total: number;
  pct: number;
  remaining: { step: StageStep; stage: number }[];
}

export function dealStageInfo(done: Record<string, boolean>): DealStageInfo {
  let stageIdx = 3;
  let doneCount = 0;
  const remaining: DealStageInfo["remaining"] = [];

  STAGES.forEach((stage, i) => {
    stage.steps.forEach((step) => {
      if (done[step.id]) {
        doneCount++;
      } else {
        remaining.push({ step, stage: i });
        if (stageIdx === 3) stageIdx = i;
      }
    });
  });

  return {
    stageIdx,
    doneCount,
    total: ALL_STEPS.length,
    pct: Math.round((doneCount / ALL_STEPS.length) * 100),
    remaining,
  };
}

export type PipelineTab = "working" | "funding" | "booked" | "funded" | "all" | "archived";

/** YYYY-MM for grouping deals by month on the pipeline board's "All this month" tab. */
export function monthOf(dateLike: string | Date): string {
  const d = typeof dateLike === "string" ? new Date(dateLike) : dateLike;
  return d.toISOString().slice(0, 7);
}

export function pipelineTab(done: Record<string, boolean>, archived: boolean): PipelineTab {
  if (archived) return "archived";
  const { stageIdx } = dealStageInfo(done);
  if (stageIdx < 2) return "working";
  if (stageIdx === 3) return "funded";
  return done.booked ? "booked" : "funding";
}
