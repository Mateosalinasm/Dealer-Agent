"use client";

import { useState, useTransition } from "react";
import { toggleStip } from "@/app/desk/deals/actions";
import { cn } from "@/lib/utils";

type Stip = { label: string; done: boolean };

export function StipChecklist({ dealId, stips }: { dealId: string; stips: Stip[] }) {
  const [localStips, setLocalStips] = useState(stips);
  const [syncedStips, setSyncedStips] = useState(stips);
  const [, startTransition] = useTransition();

  // Sync local state when the server re-renders with fresh `stips` (e.g.
  // after navigating back to this deal), without fighting optimistic
  // clicks. Adjusting state during render (React's documented pattern for
  // this) instead of an effect, so there's no extra render round-trip.
  if (stips !== syncedStips) {
    setSyncedStips(stips);
    setLocalStips(stips);
  }

  function toggle(i: number) {
    setLocalStips((prev) => prev.map((s, idx) => (idx === i ? { ...s, done: !s.done } : s)));
    startTransition(() => toggleStip(dealId, i));
  }

  return (
    <div className="flex flex-col gap-1.5">
      {localStips.map((stip, i) => (
        <label
          key={`${stip.label}-${i}`}
          className="flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-panel)] px-2 py-1.5 hover:bg-[var(--color-fill-subtle)]"
        >
          <input
            type="checkbox"
            checked={stip.done}
            onChange={() => toggle(i)}
            className="h-4 w-4 rounded accent-[var(--color-primary)]"
          />
          <span
            className={cn(
              "text-[13px] text-[var(--color-text)]",
              stip.done && "text-[var(--color-text-muted)] line-through",
            )}
          >
            {stip.label}
          </span>
        </label>
      ))}
    </div>
  );
}
