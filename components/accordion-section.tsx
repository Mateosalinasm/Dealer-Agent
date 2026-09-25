"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function AccordionSection({
  title,
  summary,
  badge,
  trailing,
  defaultOpen = false,
  forceOpenSignal,
  children,
}: {
  title: string;
  summary?: string;
  /** Rendered before the title — e.g. the numbered stage badge on the stage checklist. */
  badge?: React.ReactNode;
  /** Rendered after the summary, before the chevron — e.g. a "2/4" count. */
  trailing?: React.ReactNode;
  defaultOpen?: boolean;
  /** Any value that changes (e.g. an incrementing counter) forces the section
   *  open — for a parent that just filled in fields the user should see,
   *  like an AI auto-fill landing. Omit for a plain collapsible section. */
  forceOpenSignal?: unknown;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current && forceOpenSignal !== undefined) setOpen(true);
    mounted.current = true;
  }, [forceOpenSignal]);

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 px-4 py-3.5 text-left transition-colors hover:bg-[var(--color-fill-subtle)]"
        aria-expanded={open}
      >
        {badge}
        <span className="flex-none text-[15px] font-semibold tracking-[-.01em] text-[var(--color-text)]">{title}</span>
        {/* Always rendered (even empty) so trailing/chevron stay pinned right
            whether or not there's summary text — a bare flex-1 span with no
            content takes up the same space as one with text. */}
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--color-text-muted)]">{summary}</span>
        {trailing}
        <ChevronDown size={16} className={cn("flex-none text-[var(--color-text-placeholder)] transition-transform duration-200", open && "rotate-180")} />
      </button>
      {/* grid-template-rows 0fr→1fr is a dependency-free way to animate to
          "auto" height — the inner overflow-hidden wrapper clips the
          content while the track is animating. */}
      <div className="grid transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
        <div className="overflow-hidden">
          <div className="px-4 pb-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
