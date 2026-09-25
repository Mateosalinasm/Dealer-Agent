import { VehicleDetailView } from "@/components/vehicle-detail-view";

export const dynamic = "force-dynamic";

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VehicleDetailView id={id} />;
}
