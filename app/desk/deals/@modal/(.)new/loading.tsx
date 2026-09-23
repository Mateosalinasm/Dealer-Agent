import { RouteModal } from "@/components/route-modal";

// Same reasoning as (.)[id]/loading.tsx — NewDealView fetches vehicles +
// lenders before it can render anything; this gives instant feedback and
// lets Next.js prefetch the modal shell on hover/viewport-entry.
export default function Loading() {
  return (
    <RouteModal maxWidth="max-w-3xl">
      <div className="animate-pulse">
        <div className="flex items-center justify-between gap-3 pr-8">
          <div className="h-5 w-28 rounded bg-[var(--color-fill-subtle)]" />
          <div className="h-8 w-32 rounded-[var(--radius-pill)] bg-[var(--color-fill-subtle)]" />
        </div>
        <div className="mt-5 flex flex-col gap-3 rounded-[var(--radius-card)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)]" />
          ))}
        </div>
      </div>
    </RouteModal>
  );
}
