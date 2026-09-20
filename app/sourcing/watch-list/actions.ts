"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";

export async function updateWatchItemRunSale(
  id: string,
  fields: { runNumber?: string; saleDate?: string },
) {
  await db
    .update(schema.watchItems)
    .set({
      ...(fields.runNumber !== undefined ? { runNumber: fields.runNumber || null } : {}),
      ...(fields.saleDate !== undefined ? { saleDate: fields.saleDate || null } : {}),
    })
    .where(eq(schema.watchItems.id, id));
  revalidatePath("/sourcing/watch-list");
}

// The "on every unit" assumptions the max-bid math runs on (schema-sketch/bid-math.ts).
// Same single-row upsert pattern as setLaneBudget/setDealershipTimezone in
// app/sourcing/auction-day/actions.ts.
export async function updatePricingAssumptions(formData: FormData) {
  const targetGrossDollars = Number(formData.get("targetGrossDollars"));
  const assumedDownDollars = Number(formData.get("assumedDownDollars"));
  const holdingCostPerDayDollars = Number(formData.get("holdingCostPerDayDollars"));
  if ([targetGrossDollars, assumedDownDollars, holdingCostPerDayDollars].some((n) => Number.isNaN(n) || n < 0)) return;

  const values = {
    targetGross: Math.round(targetGrossDollars * 100),
    assumedDown: Math.round(assumedDownDollars * 100),
    holdingCostPerDay: Math.round(holdingCostPerDayDollars * 100),
  };

  const [existing] = await db.select().from(schema.settings).limit(1);
  if (existing) {
    await db.update(schema.settings).set(values).where(eq(schema.settings.id, existing.id));
  } else {
    await db.insert(schema.settings).values(values);
  }

  revalidatePath("/sourcing/watch-list");
  revalidatePath("/sourcing/auction-day");
  revalidatePath("/sourcing/sale-ledger");
}
