import { RouteModal } from "@/components/route-modal";
import { DealDetailView } from "@/components/deal-detail-view";

export default async function InterceptedDealDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RouteModal>
      <DealDetailView id={id} />
    </RouteModal>
  );
}
