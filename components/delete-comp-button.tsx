"use client";

import { deleteSaleComp } from "@/app/sourcing/sale-ledger/actions";

export function DeleteCompButton({ compId }: { compId: string }) {
  return (
    <form
      action={async () => {
        if (typeof window !== "undefined" && !window.confirm("Remove this row? sale_comps is otherwise append-only — this is a correction, not a normal delete.")) {
          return;
        }
        await deleteSaleComp(compId);
      }}
    >
      <button
        type="submit"
        aria-label="Remove row"
        className="text-[13px] text-[var(--color-delete)] hover:text-[var(--color-delete-hover)]"
      >
        ×
      </button>
    </form>
  );
}
