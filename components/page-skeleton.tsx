// Generic route-level loading state. Next.js shows this immediately on
// navigation (via loading.tsx) while the target route's server
// components fetch their data, instead of leaving the old page sitting
// there inert until everything resolves — that gap is most of what reads
// as "laggy" when clicking between sidebar sections.
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse">
      <div className="mb-5 h-6 w-40 rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)]" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-20 rounded-[var(--radius-card)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
            <div className="flex h-full items-center gap-4 px-4">
              <div className="h-3 w-32 rounded bg-[var(--color-fill-subtle)]" />
              <div className="h-3 w-24 rounded bg-[var(--color-fill-subtle)]" />
              <div className="ml-auto h-3 w-16 rounded bg-[var(--color-fill-subtle)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
