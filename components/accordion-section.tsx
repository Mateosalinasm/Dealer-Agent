"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function AccordionSection({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 px-4 py-3.5 text-left hover:bg-[var(--color-fill-subtle)]"
      >
        <span className="flex-none text-[15px] font-semibold tracking-[-.01em] text-[var(--color-text)]">{title}</span>
        {summary && <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--color-text-muted)]">{summary}</span>}
        <ChevronDown size={16} className={cn("flex-none text-[var(--color-text-placeholder)] transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
