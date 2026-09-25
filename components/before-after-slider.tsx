"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// Standard clip-path comparison slider: the "after" image is the base
// layer, and a clipped copy of the "before" image sits on top, clipped to
// only show its left `percent`% — so dragging the handle right reveals
// more of "before" on the left while "after" stays visible on the right,
// the usual convention for these. The invisible full-size range input is
// what actually drives it (mouse, touch, and keyboard arrows all just
// work), everything else is pointer-events-none decoration on top.
export function BeforeAfterSlider({ beforeSrc, afterSrc, alt, className }: { beforeSrc: string; afterSrc: string; alt: string; className?: string }) {
  const [percent, setPercent] = useState(50);

  return (
    <div className={cn("relative w-full select-none overflow-hidden rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)]", className)}>
      {/* The "after" image is a normal (non-absolute) element so it sets
          the box's size to its own natural dimensions — nothing here
          forces a crop or a particular aspect ratio. The "before" overlay
          then matches whatever box that produced. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={afterSrc} alt={`${alt} — after`} className="pointer-events-none block w-full h-auto" draggable={false} />
      <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - percent}% 0 0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={beforeSrc} alt={`${alt} — before`} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      </div>

      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)]" style={{ left: `${percent}%` }} />
      <div
        className="pointer-events-none absolute top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[var(--color-text)] shadow-[var(--shadow-card)]"
        style={{ left: `${percent}%` }}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 7-5 5 5 5M15 7l5 5-5 5" />
        </svg>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={percent}
        onChange={(e) => setPercent(Number(e.target.value))}
        aria-label="Drag to compare before and after"
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />

      {/* Quick jump to either extreme without dragging — the slider above
          still does full drag-to-compare, this is just a shortcut. Bottom
          center so it never collides with the grip/Cover badge (top-left)
          or the "..." actions menu (top-right). */}
      <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-[var(--radius-pill)] bg-black/60 p-0.5">
        <button
          type="button"
          onClick={() => setPercent(0)}
          className={cn(
            "rounded-[var(--radius-pill)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[.04em] transition-colors",
            percent === 0 ? "bg-white text-[var(--color-text)]" : "text-white",
          )}
        >
          Original
        </button>
        <button
          type="button"
          onClick={() => setPercent(100)}
          className={cn(
            "rounded-[var(--radius-pill)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[.04em] transition-colors",
            percent === 100 ? "bg-white text-[var(--color-text)]" : "text-white",
          )}
        >
          Edited
        </button>
      </div>
    </div>
  );
}
