"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Check, SlidersHorizontal } from "lucide-react";

const OPTIONS = [
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "urgent", label: "Most urgent" },
] as const;

export type SortKey = (typeof OPTIONS)[number]["key"];

export function SortMenu({ current, count }: { current: SortKey; count: number }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function choose(key: SortKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", key);
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  const currentLabel = OPTIONS.find((o) => o.key === current)?.label ?? OPTIONS[0].label;

  return (
    <div className="relative mb-3 flex items-center gap-2 text-[12.5px] text-[var(--color-text-muted)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-[var(--radius-panel)] px-1.5 py-1 hover:bg-[var(--color-fill-subtle)] hover:text-[var(--color-text)]"
        aria-expanded={open}
      >
        <SlidersHorizontal size={14} />
        <span>{currentLabel}</span>
      </button>
      <span>
        · {count} deal{count === 1 ? "" : "s"}
      </span>

      {open && (
        <>
          <button type="button" aria-label="Close sort menu" className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-[var(--radius-panel)] border border-[var(--color-hairline)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-card)]">
            {OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => choose(o.key)}
                className="flex w-full items-center justify-between rounded-[var(--radius-panel)] px-2.5 py-1.5 text-left text-[12.5px] text-[var(--color-text)] hover:bg-[var(--color-fill-subtle)]"
              >
                {o.label}
                {o.key === current && <Check size={14} className="text-[var(--color-primary)]" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
