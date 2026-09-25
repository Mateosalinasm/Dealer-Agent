import { asc, desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { InventoryImport } from "@/components/inventory-import";
import { AddVehicleModal } from "@/components/add-vehicle-modal";
import { InventoryGrid, type InventoryVehicleCard } from "@/components/inventory-grid";

export const dynamic = "force-dynamic";

function daysAtLot(acquiredOn: string | null): number | null {
  if (!acquiredOn) return null;
  const acquired = new Date(acquiredOn + "T00:00:00");
  const days = Math.floor((Date.now() - acquired.getTime()) / 86_400_000);
  return days >= 0 ? days : null;
}

export default async function InventoryPage() {
  const [vehicles, photoRows, dealVehicleRows] = await Promise.all([
    db.select().from(schema.vehicles).orderBy(desc(schema.vehicles.createdAt)),
    db.select().from(schema.vehiclePhotos).orderBy(asc(schema.vehiclePhotos.sortOrder)),
    db.select({ vehicleId: schema.deals.vehicleId }).from(schema.deals),
  ]);

  // Vehicles with a deal on file — the bulk-delete confirmation warns
  // before deleting one of these, since the delete itself always succeeds
  // (deals.vehicleId is onDelete: 'set null', never a hard FK failure) but
  // silently orphans that deal's vehicle link.
  const vehicleIdsWithDeal = new Set(dealVehicleRows.map((d) => d.vehicleId).filter((id): id is string => !!id));

  // First photo per vehicle (by sortOrder, i.e. upload order) is the cover
  // shown on the card — same "first in the gallery" photo the detail page
  // shows first. Edited version wins over the original once one exists.
  const photosByVehicle = new Map<string, { id: string; url: string }[]>();
  for (const p of photoRows) {
    const list = photosByVehicle.get(p.vehicleId) ?? [];
    list.push({ id: p.id, url: p.editedStoragePath ? `/api/vehicle-photos/${p.id}/file?v=edited` : `/api/vehicle-photos/${p.id}/file` });
    photosByVehicle.set(p.vehicleId, list);
  }

  const cards: InventoryVehicleCard[] = vehicles.map((v) => {
    const photos = photosByVehicle.get(v.id) ?? [];
    return {
      id: v.id,
      label: `${v.year ?? ""} ${v.make ?? ""} ${v.model ?? ""} ${v.trim ?? ""}`.replace(/\s+/g, " ").trim(),
      stockNumber: v.stockNumber,
      vin: v.vin,
      color: v.color,
      miles: v.miles,
      daysAtLot: daysAtLot(v.acquiredOn),
      costCents: (v.hammer ?? 0) + (v.buyFee ?? 0) + v.tow + v.recon,
      askingCents: v.askingPrice,
      sold: v.sold,
      coverUrl: photos[0]?.url ?? null,
      photos,
      hasDeal: vehicleIdsWithDeal.has(v.id),
    };
  });

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">
          Inventory
        </h1>
        <AddVehicleModal />
      </div>

      <InventoryImport />

      <div className="mt-4 mb-3 text-[13.5px] font-semibold text-[var(--color-text)]">
        Current stock · {vehicles.length}
      </div>

      <InventoryGrid vehicles={cards} />
    </div>
  );
}
