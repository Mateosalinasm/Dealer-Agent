import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/utils";

export default async function PriorityQueuePage() {
  const deals = await db
    .select()
    .from(schema.deals)
    .where(eq(schema.deals.funded, false))
    .orderBy(desc(schema.deals.createdAt));

  const vehicleIds = deals.map((d) => d.vehicleId).filter((v): v is string => !!v);
  const vehicles = vehicleIds.length
    ? await db.select().from(schema.vehicles)
    : [];
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">
          Priority queue
        </h1>
        <Link href="/desk/deals/new">
          <Button type="button">New deal</Button>
        </Link>
      </div>

      {deals.length === 0 ? (
        <div className="rounded-[var(--radius-card)] bg-[var(--color-surface)] p-8 text-center">
          <div className="text-[15px] font-semibold text-[var(--color-text)]">No open deals</div>
          <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
            Create one to start tracking stips through to funding.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {deals.map((deal) => {
            const vehicle = deal.vehicleId ? vehicleById.get(deal.vehicleId) : null;
            const doneCount = deal.stips.filter((s) => s.done).length;
            const progressPct = deal.stips.length ? Math.round((doneCount / deal.stips.length) * 100) : 0;
            const openStips = deal.stips.length - doneCount;

            return (
              <Link key={deal.id} href={`/desk/deals/${deal.id}`}>
                <Card className="flex items-center justify-between transition-shadow hover:shadow-md">
                  <div>
                    <div className="text-[13.5px] font-semibold text-[var(--color-text)]">
                      {deal.customerName}
                    </div>
                    <div className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                      {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "No vehicle attached"}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {deal.salePrice != null && (
                      <span className="tabular-nums text-[12.5px] text-[var(--color-text-muted)]">
                        {formatCents(deal.salePrice)}
                      </span>
                    )}
                    <Badge tone={openStips === 0 ? "positive" : "caution"}>
                      {openStips === 0 ? "Stips clear" : `${openStips} stip${openStips === 1 ? "" : "s"} open`}
                    </Badge>
                    <span className="w-10 text-right tabular-nums text-[12px] text-[var(--color-text-muted)]">
                      {progressPct}%
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
