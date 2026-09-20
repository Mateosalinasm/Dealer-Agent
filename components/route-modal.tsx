"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";

// Chrome for an intercepted-route modal (see app/desk/deals/@modal). The
// board underneath never unmounts — this just overlays on top of it.
// Clicking the backdrop or the X calls router.back(), which pops back to
// the board's URL and lets Next.js swap this slot back to empty.
export function RouteModal({ children, maxWidth = "max-w-3xl" }: { children: React.ReactNode; maxWidth?: string }) {
  const router = useRouter();
  const close = () => router.back();

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-black/30 p-6" onClick={close}>
      <div
        className={`relative mx-auto mt-6 mb-6 w-full ${maxWidth} rounded-[var(--radius-card)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)]`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          className="absolute right-4 top-4 z-10 rounded-full bg-[var(--color-surface)] p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-fill-subtle)]"
          aria-label="Close"
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}
