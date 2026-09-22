import { getRunListContext } from "@/lib/run-list-data";
import { RunListWorkspace } from "@/components/run-list-workspace";

export const dynamic = "force-dynamic";

export default async function RunListPage() {
  const ctx = await getRunListContext();

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">Run list</h1>
        <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
          Paste a raw auction run list and price every unit against your own numbers before you walk in.
        </p>
      </div>
      <RunListWorkspace
        targetGross={ctx.targetGross}
        holdingCost={ctx.holdingCost}
        turnDays={ctx.turnDays}
        holdingPerDay={ctx.holdingPerDay}
        leads={ctx.leads}
        vehicles={ctx.vehicles}
        comps={ctx.comps}
      />
    </div>
  );
}
