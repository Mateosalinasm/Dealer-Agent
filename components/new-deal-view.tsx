import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { Card } from "@/components/ui/card";
import { NewDealForm } from "@/components/new-deal-form";

export async function NewDealView() {
  const [unsoldVehicles, lenders] = await Promise.all([
    db.select().from(schema.vehicles).where(eq(schema.vehicles.sold, false)),
    db.select().from(schema.lenders).where(eq(schema.lenders.active, true)),
  ]);

  return (
    <div>
      <h1 className="text-[19px] font-semibold tracking-[-.01em] text-[var(--color-text)]">New deal</h1>
      <Card className="mt-5">
        <NewDealForm vehicles={unsoldVehicles} lenders={lenders} />
      </Card>
    </div>
  );
}
