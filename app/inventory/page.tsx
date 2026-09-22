import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InventoryImport } from "@/components/inventory-import";
import { AddVehicleModal } from "@/components/add-vehicle-modal";
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
  const vehicles = await db.select().from(schema.vehicles).orderBy(desc(schema.vehicles.createdAt));

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">
          Inventory
        </h1>
        <AddVehicleModal />
      </div>

      <InventoryImport />

      <Card className="mt-4">
        <div className="mb-3 text-[13.5px] font-semibold text-[var(--color-text)]">
          Current stock · {vehicles.length}
        </div>
        {vehicles.length === 0 ? (
          <p className="text-[12.5px] text-[var(--color-text-muted)]">
            Nothing in inventory yet — import a stock list above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-[var(--color-header-rule)] text-left text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
                  <th className="px-2 py-2">Vehicle</th>
                  <th className="px-2 py-2">Color</th>
                  <th className="px-2 py-2">Miles</th>
                  <th className="px-2 py-2">Days at lot</th>
                  <th className="px-2 py-2">Asking</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => {
                  const days = daysAtLot(v.acquiredOn);
                  return (
                    <tr key={v.id} className="border-b border-[var(--color-hairline)] hover:bg-[var(--color-row-hover)]">
                      <td className="px-2 py-2">
                        <div className="font-medium text-[var(--color-text)]">
                          {v.year} {v.make} {v.model} {v.trim ?? ""}
                        </div>
                        <div className="text-[11px] text-[var(--color-text-muted)]">
                          {v.stockNumber ? `#${v.stockNumber}` : v.vin ?? "—"}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-[var(--color-text-muted)]">{v.color ?? "—"}</td>
                      <td className="px-2 py-2 tabular-nums text-[var(--color-text-muted)]">
                        {v.miles != null ? v.miles.toLocaleString() : "—"}
                      </td>
                      <td className="px-2 py-2 tabular-nums text-[var(--color-text-muted)]">
                        {days != null ? `${days}d` : "—"}
                      </td>
                      <td className="px-2 py-2 tabular-nums text-[var(--color-text)]">
                        {formatCents(v.askingPrice)}
                      </td>
                      <td className="px-2 py-2">
                        <Badge tone={v.sold ? "neutral" : "positive"}>{v.sold ? "Sold" : "In stock"}</Badge>
                      </td>
                      <td className="px-2 py-2">
                        <form action={markVehicleSold.bind(null, v.id, !v.sold)}>
                          <Button type="submit" variant="secondary" className="px-2 py-1 text-[11px]">
                            {v.sold ? "Mark in stock" : "Mark sold"}
                          </Button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
