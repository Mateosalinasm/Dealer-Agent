import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NewDealWithCreditApp } from "@/components/new-deal-with-credit-app";

export async function NewDealView() {
  const [unsoldVehicles, lenders] = await Promise.all([
    db.select().from(schema.vehicles).where(eq(schema.vehicles.sold, false)),
    db.select().from(schema.lenders).where(eq(schema.lenders.active, true)),
  ]);

  return <NewDealWithCreditApp vehicles={unsoldVehicles} lenders={lenders} />;
}
