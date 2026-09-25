import { asc, desc } from "drizzle-orm";
import Link from "next/link";
import { Car } from "lucide-react";
import { db, schema } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InventoryImport } from "@/components/inventory-import";
import { AddVehicleModal } from "@/components/add-vehicle-modal";
import { VehicleGalleryButton } from "@/components/vehicle-gallery-button";
import { formatCents } from "@/lib/utils";
import { markVehicleSold } from "@/app/inventory/actions";

export const dynamic = "force-dynamic";

function daysAtLot(acquiredOn: string | null): number | null {
  if (!acquiredOn) return null;
  const acquired = new Date(acquiredOn + "T00:00:00");
  const days = Math.floor((Date.now() - acquired.getTime()) / 86_400_000);
  return days >= 0 ? days : null;
}

export default async function InventoryPage() {
  const [vehicles, photoRows] = await Promise.all([
    db.select().from(schema.vehicles).orderBy(desc(schema.vehicles.createdAt)),
    db.select().from(schema.vehiclePhotos).orderBy(asc(schema.vehiclePhotos.sortOrder)),
  ]);

  // First photo per vehicle (by sortOrder, i.e. upload order) is the cover
  // shown on the card — same "first in the gallery" photo the detail page
  // shows first. Edited version wins over the original once one exists.
  const photosByVehicle = new Map<string, { id: string; url: string }[]>();
  for (const p of photoRows) {
    const list = photosByVehicle.get(p.vehicleId) ?? [];
    list.push({ id: p.id, url: p.editedStoragePath ? `/api/vehicle-photos/${p.id}/file?v=edited` : `/api/vehicle-photos/${p.id}/file` });
    photosByVehicle.set(p.vehicleId, list);
  }

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

      {vehicles.length === 0 ? (
        <Card>
          <p className="text-[12.5px] text-[var(--color-text-muted)]">
            Nothing in inventory yet — import a stock list above.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {vehicles.map((v) => {
            const days = daysAtLot(v.acquiredOn);
            const photos = photosByVehicle.get(v.id) ?? [];
            const coverUrl = photos[0]?.url;
            const label = `${v.year ?? ""} ${v.make ?? ""} ${v.model ?? ""} ${v.trim ?? ""}`.replace(/\s+/g, " ").trim();
            const costCents = (v.hammer ?? 0) + (v.buyFee ?? 0) + v.tow + v.recon;

            return (
              <Card key={v.id} className="relative flex flex-col overflow-hidden p-0">
                <Link href={`/inventory/${v.id}`} className="absolute inset-0 z-0" aria-label={`Open ${label || "vehicle"}`} />

                <div className="relative aspect-[4/3] w-full bg-[var(--color-fill-subtle)]">
                  {coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverUrl} alt={label || "Vehicle photo"} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Car size={28} className="text-[var(--color-text-placeholder)]" />
                    </div>
                  )}
                  <div className="absolute right-2 top-2 flex items-center gap-1.5">
                    <VehicleGalleryButton photos={photos} label={label || "Vehicle"} />
                  </div>
                  <div className="absolute left-2 top-2">
                    <Badge tone={v.sold ? "neutral" : "positive"}>{v.sold ? "Sold" : "In stock"}</Badge>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div>
                    <div className="truncate text-[14px] font-semibold text-[var(--color-text)]">{label || "Vehicle"}</div>
                    <div className="truncate text-[11px] text-[var(--color-text-muted)]">
                      {v.stockNumber ? `#${v.stockNumber}` : v.vin ?? "—"}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
                    <div className="flex justify-between text-[var(--color-text-muted)]">
                      <span>Color</span>
                      <span className="font-medium text-[var(--color-text)]">{v.color ?? "—"}</span>
                    </div>
                    <div className="flex justify-between text-[var(--color-text-muted)]">
                      <span>Miles</span>
                      <span className="tabular-nums font-medium text-[var(--color-text)]">{v.miles != null ? v.miles.toLocaleString() : "—"}</span>
                    </div>
                    <div className="flex justify-between text-[var(--color-text-muted)]">
                      <span>Days at lot</span>
                      <span className="tabular-nums font-medium text-[var(--color-text)]">{days != null ? `${days}d` : "—"}</span>
                    </div>
                    <div className="flex justify-between text-[var(--color-text-muted)]">
                      <span>Cost</span>
                      <span className="tabular-nums font-medium text-[var(--color-text)]">{formatCents(costCents)}</span>
                    </div>
                    <div className="col-span-2 flex justify-between border-t border-[var(--color-hairline)] pt-1.5 text-[13px]">
                      <span className="text-[var(--color-text-muted)]">Asking</span>
                      <span className="tabular-nums font-semibold text-[var(--color-text)]">{formatCents(v.askingPrice)}</span>
                    </div>
                  </div>

                  <form action={markVehicleSold.bind(null, v.id, !v.sold)} className="relative z-10 mt-auto">
                    <Button type="submit" variant="secondary" className="w-full px-2 py-1.5 text-[11px]">
                      {v.sold ? "Mark in stock" : "Mark sold"}
                    </Button>
                  </form>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
