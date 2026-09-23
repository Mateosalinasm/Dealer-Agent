import { RouteModal } from "@/components/route-modal";
import { DealModalSkeleton } from "@/components/deal-modal-skeleton";

// Shown the instant a deal card is clicked — DealDetailView (rendered by
// this segment's page.tsx) runs 8 queries in parallel, and without this
// file Next.js has nothing to show until all of them resolve, and won't
// prefetch this route at all (a dynamic route is only prefetched up to
// its first loading boundary — see the "Prefetching" guide under
// node_modules/next/dist/docs). This is most of what read as "laggy."
export default function Loading() {
  return (
    <RouteModal>
      <DealModalSkeleton />
    </RouteModal>
  );
}
