import { DealDetailView } from "@/components/deal-detail-view";

export const dynamic = "force-dynamic";

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-3xl">
      <DealDetailView id={id} />
    </div>
  );
}
