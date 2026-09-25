"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { saveFile, readStoredFile } from "@/lib/storage";
import { extractDocument } from "@/lib/extraction";
import { decodeVin, type VinDecodeResult } from "@/lib/vin-decoder";
import { getDealershipTimezone, todayInTimezone } from "@/lib/dealership-time";
import { editVehicleSchema, manualVehicleSchema, vehicleImportRowSchema, type VehicleImportRow, type VehicleImportRowInput } from "@/lib/validation";

export async function decodeVinForForm(vin: string): Promise<VinDecodeResult> {
  return decodeVin(vin);
}

// Re-uploading a stock list is the normal workflow (auction runs change
// hands, costs get corrected, a fresh export comes in) — it must never
// duplicate a vehicle that's already here or blow away what's already on
// file for it (photos, in particular, live in a separate table keyed by
// vehicleId and are never touched by this). Matched by VIN first, falling
// back to stock # when a row has no VIN, against vehicles currently marked
// in stock — a sold vehicle is left alone even if its old VIN/stock #
// happens to reappear. A field only overwrites the existing value when the
// row actually provides one; a blank cell never blanks out something
// that's already on file. Anything in stock that this upload doesn't
// mention at all is assumed sold, on the theory that a fresh list reflects
// what's actually still on the lot.
export async function importVehicles(rows: VehicleImportRowInput[]) {
  if (rows.length === 0) return { imported: 0, updated: 0, markedSold: 0, errors: [] as string[] };

  const today = todayInTimezone(await getDealershipTimezone());
  const errors: string[] = [];
  const parsedRows: VehicleImportRow[] = [];

  rows.forEach((raw, idx) => {
    const parsed = vehicleImportRowSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push(`Row ${idx + 1}: ${parsed.error.issues.map((e) => e.message).join(", ")}`);
      return;
    }
    parsedRows.push(parsed.data);
  });

  if (parsedRows.length === 0) {
    return { imported: 0, updated: 0, markedSold: 0, errors };
  }

  const inStock = await db.select().from(schema.vehicles).where(eq(schema.vehicles.sold, false));
  const byVin = new Map(inStock.filter((v) => v.vin).map((v) => [v.vin!.trim().toUpperCase(), v]));
  const byStock = new Map(inStock.filter((v) => v.stockNumber).map((v) => [v.stockNumber!.trim().toLowerCase(), v]));

  const matchedIds = new Set<string>();
  const inserts: (typeof schema.vehicles.$inferInsert)[] = [];
  let updated = 0;

  for (const row of parsedRows) {
    const vinKey = row.vin?.trim().toUpperCase();
    const stockKey = row.stockNumber?.trim().toLowerCase();
    const existing = (vinKey && byVin.get(vinKey)) || (stockKey && byStock.get(stockKey)) || undefined;

    if (existing) {
      matchedIds.add(existing.id);
      const patch: Partial<typeof schema.vehicles.$inferInsert> = {};
      if (row.stockNumber) patch.stockNumber = row.stockNumber;
      if (row.vin) patch.vin = row.vin;
      if (row.year != null) patch.year = row.year;
      if (row.make) patch.make = row.make;
      if (row.model) patch.model = row.model;
      if (row.trim) patch.trim = row.trim;
      if (row.color) patch.color = row.color;
      if (row.bodyType) patch.bodyType = row.bodyType;
      if (row.miles != null) patch.miles = row.miles;
      if (row.askingPriceDollars != null) patch.askingPrice = Math.round(row.askingPriceDollars * 100);
      if (row.costDollars != null) patch.hammer = Math.round(row.costDollars * 100);
      if (row.acquiredOn) patch.acquiredOn = row.acquiredOn;

      if (Object.keys(patch).length > 0) {
        await db.update(schema.vehicles).set(patch).where(eq(schema.vehicles.id, existing.id));
        updated++;
      }
    } else {
      inserts.push({
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
        hammer: row.costDollars != null ? Math.round(row.costDollars * 100) : null,
        acquiredOn: row.acquiredOn || today,
        title: "clean",
      });
    }
  }

  if (inserts.length > 0) {
    await db.insert(schema.vehicles).values(inserts);
  }

  const disappeared = inStock.filter((v) => !matchedIds.has(v.id));
  for (const v of disappeared) {
    await db.update(schema.vehicles).set({ sold: true, soldOn: today }).where(eq(schema.vehicles.id, v.id));
  }

  if (inserts.length > 0 || updated > 0 || disappeared.length > 0) {
    revalidatePath("/inventory");
    revalidatePath("/desk/deals/new");
    revalidatePath("/sourcing/what-to-buy");
    revalidatePath("/sourcing/buy-scorecard");
  }

  return { imported: inserts.length, updated, markedSold: disappeared.length, errors };
}

export async function markVehicleSold(vehicleId: string, sold: boolean) {
  const soldOn = sold ? todayInTimezone(await getDealershipTimezone()) : null;
  await db.update(schema.vehicles).set({ sold, soldOn }).where(eq(schema.vehicles.id, vehicleId));
  revalidatePath("/inventory");
  revalidatePath("/sourcing/what-to-buy");
  revalidatePath("/sourcing/buy-scorecard");
}

export async function updateVehicle(vehicleId: string, formData: FormData) {
  const parsed = editVehicleSchema.parse({
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
    hammerDollars: formData.get("hammerDollars") || undefined,
    buyFeeDollars: formData.get("buyFeeDollars") || undefined,
    towDollars: formData.get("towDollars") || undefined,
    reconDollars: formData.get("reconDollars") || undefined,
    lot: formData.get("lot") ?? "",
    acquiredOn: formData.get("acquiredOn") ?? "",
    fuelType: formData.get("fuelType") || "gas",
    isThreeRowSuv: formData.get("isThreeRowSuv"),
    notes: formData.get("notes") ?? "",
  });

  await db
    .update(schema.vehicles)
    .set({
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
      hammer: parsed.hammerDollars != null ? Math.round(parsed.hammerDollars * 100) : null,
      buyFee: parsed.buyFeeDollars != null ? Math.round(parsed.buyFeeDollars * 100) : null,
      tow: parsed.towDollars != null ? Math.round(parsed.towDollars * 100) : 0,
      recon: parsed.reconDollars != null ? Math.round(parsed.reconDollars * 100) : 0,
      lot: parsed.lot || null,
      acquiredOn: parsed.acquiredOn || null,
      fuelType: parsed.fuelType,
      isThreeRowSuv: parsed.isThreeRowSuv,
      notes: parsed.notes || null,
    })
    .where(eq(schema.vehicles.id, vehicleId));

  revalidatePath(`/inventory/${vehicleId}`);
  revalidatePath("/inventory");
  revalidatePath("/desk/deals/new");
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
