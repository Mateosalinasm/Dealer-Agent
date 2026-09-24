"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { saveFile, readStoredFile } from "@/lib/storage";
import { extractDocument } from "@/lib/extraction";
import { decodeVin, type VinDecodeResult } from "@/lib/vin-decoder";
import { getDealershipTimezone, todayInTimezone } from "@/lib/dealership-time";
import { manualVehicleSchema, vehicleImportRowSchema, type VehicleImportRowInput } from "@/lib/validation";

export async function decodeVinForForm(vin: string): Promise<VinDecodeResult> {
  return decodeVin(vin);
}

export async function importVehicles(rows: VehicleImportRowInput[]) {
  if (rows.length === 0) return { imported: 0, errors: [] as string[] };

  const today = todayInTimezone(await getDealershipTimezone());
  const errors: string[] = [];
  const values: (typeof schema.vehicles.$inferInsert)[] = [];

  rows.forEach((raw, idx) => {
    const parsed = vehicleImportRowSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push(`Row ${idx + 1}: ${parsed.error.issues.map((e) => e.message).join(", ")}`);
      return;
    }
    const row = parsed.data;
    values.push({
      stockNumber: row.stockNumber || null,
      vin: row.vin || null,
      year: row.year ?? null,
      make: row.make || null,
      model: row.model || null,
      trim: row.trim || null,
      color: row.color || null,
      bodyType: row.bodyType ?? null,
      miles: row.miles ?? null,
      askingPrice: row.askingPriceDollars != null ? Math.round(row.askingPriceDollars * 100) : null,
      acquiredOn: row.acquiredOn || today,
      title: "clean",
    });
  });

  if (values.length > 0) {
    await db.insert(schema.vehicles).values(values);
    revalidatePath("/inventory");
    revalidatePath("/desk/deals/new");
  }

  return { imported: values.length, errors };
}

export async function markVehicleSold(vehicleId: string, sold: boolean) {
  const soldOn = sold ? todayInTimezone(await getDealershipTimezone()) : null;
  await db.update(schema.vehicles).set({ sold, soldOn }).where(eq(schema.vehicles.id, vehicleId));
  revalidatePath("/inventory");
  revalidatePath("/sourcing/what-to-buy");
  revalidatePath("/sourcing/buy-scorecard");
}

// --- Manual "Add vehicle" + AutoCheck read-through -----------------------
//
// The AutoCheck uploads before the vehicle exists (its whole point is to
// pre-fill the form), so it's stored as an orphan document — vehicleId
// null — the moment it's picked, analyzed immediately, and only linked to
// the real vehicle row once "Add vehicle" is actually submitted. If the
// operator closes the modal without submitting, deleteAutocheckDraft
// cleans it up.

export async function uploadAutocheckDraft(formData: FormData): Promise<{ documentId: string }> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    throw new Error("No file selected");
  }
  const { storagePath, fileSize } = await saveFile(file);
  const [doc] = await db
    .insert(schema.documents)
    .values({
      category: "autocheck",
      fileName: file.name,
      storagePath,
      mimeType: file.type || null,
      fileSize,
    })
    .returning();
  return { documentId: doc.id };
}

export async function analyzeAutocheckDraft(documentId: string) {
  const [doc] = await db.select().from(schema.documents).where(eq(schema.documents.id, documentId)).limit(1);
  if (!doc) return { ok: false, error: "Document not found" };

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

  return result;
}

export async function deleteAutocheckDraft(documentId: string) {
  await db.delete(schema.documents).where(eq(schema.documents.id, documentId));
}

export async function createVehicleManually(formData: FormData) {
  const parsed = manualVehicleSchema.parse({
    stockNumber: formData.get("stockNumber") ?? "",
    vin: formData.get("vin") ?? "",
    year: formData.get("year") || undefined,
    make: formData.get("make") ?? "",
    model: formData.get("model") ?? "",
    trim: formData.get("trim") ?? "",
    color: formData.get("color") ?? "",
    bodyType: formData.get("bodyType") ?? "",
    title: formData.get("title") || "clean",
    miles: formData.get("miles") || undefined,
    priceDollars: formData.get("priceDollars") || undefined,
    costDollars: formData.get("costDollars") || undefined,
    lot: formData.get("lot") ?? "",
    daysOnLot: formData.get("daysOnLot") || 0,
    autocheckDocumentId: formData.get("autocheckDocumentId") ?? "",
    fuelType: formData.get("fuelType") || "gas",
    isThreeRowSuv: formData.get("isThreeRowSuv"),
  });

  const today = todayInTimezone(await getDealershipTimezone());
  const acquired = new Date(`${today}T00:00:00Z`);
  acquired.setUTCDate(acquired.getUTCDate() - parsed.daysOnLot);
  const acquiredOn = acquired.toISOString().slice(0, 10);

  const [vehicle] = await db
    .insert(schema.vehicles)
    .values({
      stockNumber: parsed.stockNumber || null,
      vin: parsed.vin || null,
      year: parsed.year ?? null,
      make: parsed.make || null,
      model: parsed.model || null,
      trim: parsed.trim || null,
      color: parsed.color || null,
      bodyType: parsed.bodyType || null,
      title: parsed.title,
      miles: parsed.miles ?? null,
      askingPrice: parsed.priceDollars != null ? Math.round(parsed.priceDollars * 100) : null,
      hammer: parsed.costDollars != null ? Math.round(parsed.costDollars * 100) : null,
      lot: parsed.lot || null,
      acquiredOn,
      fuelType: parsed.fuelType,
      isThreeRowSuv: parsed.isThreeRowSuv,
    })
    .returning();

  if (parsed.autocheckDocumentId) {
    await db
      .update(schema.documents)
      .set({ vehicleId: vehicle.id })
      .where(eq(schema.documents.id, parsed.autocheckDocumentId));
  }

  revalidatePath("/inventory");
  revalidatePath("/desk/deals/new");
}
