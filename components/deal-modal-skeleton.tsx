// Shown instantly (via loading.tsx) the moment a deal card is clicked,
// before DealDetailView's queries resolve — see
// app/desk/deals/@modal/(.)[id]/loading.tsx. Roughly traces the real
// layout (header, health card, accordion rows) so the swap-in doesn't
// jump the page around once the real content streams in.
export function DealModalSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="h-5 w-36 rounded bg-[var(--color-fill-subtle)]" />
            <div className="h-5 w-5 rounded-full bg-[var(--color-fill-subtle)]" />
            <div className="h-5 w-5 rounded-full bg-[var(--color-fill-subtle)]" />
          </div>
          <div className="h-3 w-52 rounded bg-[var(--color-fill-subtle)]" />
        </div>
        <div className="h-8 w-20 flex-none rounded-[var(--radius-pill)] bg-[var(--color-fill-subtle)]" />
      </div>

      <div className="h-24 rounded-[var(--radius-card)] bg-[var(--color-fill-subtle)]" />

      <div className="mt-4 flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-11 rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)]" />
        ))}
      </div>
    </div>
  );
}
