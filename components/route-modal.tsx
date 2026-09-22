"use client";

import { useRouter } from "next/navigation";

// Chrome for an intercepted-route modal (see app/desk/deals/@modal). The
// board underneath never unmounts — this just overlays on top of it.
// Closes only by clicking the backdrop (router.back(), which pops back to
// the board's URL and lets Next.js swap this slot back to empty) — no
// explicit close button, matching the design.
export function RouteModal({ children, maxWidth = "max-w-3xl" }: { children: React.ReactNode; maxWidth?: string }) {
  const router = useRouter();
  const close = () => router.back();

  return (
    <div
      className="fixed inset-0 z-40 overflow-y-auto bg-black/30 p-6 [animation:route-modal-overlay-in_180ms_ease-out]"
      onClick={close}
    >
      <div
        className={`relative mx-auto mt-6 mb-6 w-full ${maxWidth} rounded-[var(--radius-card)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)] [animation:route-modal-content-in_200ms_cubic-bezier(0.16,1,0.3,1)]`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
