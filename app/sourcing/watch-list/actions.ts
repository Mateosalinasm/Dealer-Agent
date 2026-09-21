"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { saveFile, readStoredFile } from "@/lib/storage";
import { extractDocument } from "@/lib/extraction";

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

// --- AutoCheck upload -----------------------------------------------------
// A watch_items row is pre-purchase — attaching an AutoCheck here is a
// scouting reference for a unit that hasn't been bought yet, separate from
// the AutoCheck a vehicle gets once it's actually owned (Add vehicle).
// Uploads immediately, same as the deal-page document flow.

export async function uploadWatchItemAutocheck(watchItemId: string, formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    throw new Error("No file selected");
  }

  const { storagePath, fileSize } = await saveFile(file);
  await db.insert(schema.documents).values({
    watchItemId,
    category: "autocheck",
    fileName: file.name,
    storagePath,
    mimeType: file.type || null,
    fileSize,
  });

  revalidatePath("/sourcing/watch-list");
}

export async function analyzeWatchItemDocument(watchItemId: string, documentId: string) {
  const [doc] = await db.select().from(schema.documents).where(eq(schema.documents.id, documentId)).limit(1);
  if (!doc) return;

  await db.update(schema.documents).set({ extractionStatus: "pending" }).where(eq(schema.documents.id, documentId));

  const fileBuffer = await readStoredFile(doc.storagePath);
  const result = await extractDocument("autocheck", fileBuffer, doc.mimeType);

  if (result.ok) {
    await db
      .update(schema.documents)
      .set({ extractionStatus: "success", extractedData: result.data, extractedAt: new Date(), extractionError: null })
      .where(eq(schema.documents.id, documentId));
  } else {
    await db
      .update(schema.documents)
      .set({ extractionStatus: "failed", extractionError: result.error ?? "Unknown error", extractedAt: new Date() })
      .where(eq(schema.documents.id, documentId));
  }

  revalidatePath("/sourcing/watch-list");
}

export async function deleteWatchItemDocument(watchItemId: string, documentId: string) {
  await db.delete(schema.documents).where(eq(schema.documents.id, documentId));
  revalidatePath("/sourcing/watch-list");
}
