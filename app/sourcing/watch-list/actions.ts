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
