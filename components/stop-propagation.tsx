"use client";

// Wraps an interactive child (e.g. a dialog trigger) that sits inside a
// Link so clicking it opens the dialog instead of also navigating.
export function StopPropagation({ children }: { children: React.ReactNode }) {
  return (
    <span onClick={(e) => e.stopPropagation()} className="inline-flex flex-none items-center gap-1">
      {children}
    </span>
  );
}
