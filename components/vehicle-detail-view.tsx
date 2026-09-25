import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { db, schema } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VehiclePhotosSection } from "@/components/vehicle-photos-section";
import type { VehiclePhotoDTO } from "@/components/vehicle-photo-card";
import { formatCents } from "@/lib/utils";

export async function VehicleDetailView({ id }: { id: string }) {
  const [vehicle] = await db.select().from(schema.vehicles).where(eq(schema.vehicles.id, id)).limit(1);
  if (!vehicle) notFound();

  const photoRows = await db.select().from(schema.vehiclePhotos).where(eq(schema.vehiclePhotos.vehicleId, id)).orderBy(asc(schema.vehiclePhotos.sortOrder));

  const photos: VehiclePhotoDTO[] = photoRows.map((p) => ({
    id: p.id,
    originalUrl: `/api/vehicle-photos/${p.id}/file`,
    editedUrl: p.editedStoragePath ? `/api/vehicle-photos/${p.id}/file?v=edited` : null,
    status: p.status,
    editSettings: p.editSettings,
    editError: p.editError,
  }));

  const label = `${vehicle.year ?? ""} ${vehicle.make ?? ""} ${vehicle.model ?? ""} ${vehicle.trim ?? ""}`.replace(/\s+/g, " ").trim();

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/inventory" className="mb-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
        <ChevronLeft size={15} /> Inventory
      </Link>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">{label || "Vehicle"}</h1>
            <div className="mt-0.5 text-[12.5px] text-[var(--color-text-muted)]">
              {vehicle.stockNumber ? `#${vehicle.stockNumber}` : vehicle.vin ?? "—"}
              {vehicle.color ? ` · ${vehicle.color}` : ""}
              {vehicle.miles != null ? ` · ${vehicle.miles.toLocaleString()} mi` : ""}
            </div>
          </div>
          <Badge tone={vehicle.sold ? "neutral" : "positive"}>{vehicle.sold ? "Sold" : "In stock"}</Badge>
        </div>
        <div className="mt-3 flex items-baseline gap-4 text-[13px]">
          <div className="text-[var(--color-text)]">
            <span className="font-semibold">{formatCents(vehicle.askingPrice)}</span>
            <span className="ml-1.5 text-[var(--color-text-muted)]">asking</span>
          </div>
        </div>
      </Card>

      <VehiclePhotosSection vehicleId={vehicle.id} vehicleLabel={label || "Vehicle"} photos={photos} />
    </div>
  );
}
