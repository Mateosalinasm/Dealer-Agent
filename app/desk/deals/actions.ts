"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import { saveFile, readStoredFile } from "@/lib/storage";
import { extractDocument } from "@/lib/extraction";
import { isExtractable } from "@/lib/extraction-schemas";
import { getDealershipTimezone, todayInTimezone } from "@/lib/dealership-time";
import {
  appointmentSchema,
  dealInfoSchema,
  documentUploadSchema,
  newDealSchema,
} from "@/lib/validation";

const DEFAULT_STIPS = ["POI", "POR", "TurboPass", "Insurance"].map((label) => ({
  label,
  done: false,
}));

export async function createDeal(formData: FormData) {
  const parsed = newDealSchema.parse({
    customerName: formData.get("customerName"),
    vehicleId: formData.get("vehicleId") ?? "",
    notes: formData.get("notes") ?? "",
  });

  const [deal] = await db
    .insert(schema.deals)
    .values({
      customerName: parsed.customerName,
      vehicleId: parsed.vehicleId || null,
      notes: parsed.notes || null,
      dealDate: todayInTimezone(await getDealershipTimezone()),
      stips: DEFAULT_STIPS,
    })
    .returning();

  revalidatePath("/desk/priority-queue");
  redirect(`/desk/deals/${deal.id}`);
}

export async function updateDealInfo(dealId: string, formData: FormData) {
  const parsed = dealInfoSchema.parse({
    lenderId: formData.get("lenderId") ?? "",
    programId: formData.get("programId") ?? "",
    salePriceDollars: formData.get("salePriceDollars") || undefined,
    cashDownDollars: formData.get("cashDownDollars") || undefined,
    termMonths: formData.get("termMonths") || undefined,
    aprPct: formData.get("aprPct") || undefined,
    backEndGrossDollars: formData.get("backEndGrossDollars") || undefined,
    notes: formData.get("notes") ?? "",
  });

  await db
    .update(schema.deals)
    .set({
      lenderId: parsed.lenderId || null,
      programId: parsed.programId || null,
      salePrice: parsed.salePriceDollars != null ? Math.round(parsed.salePriceDollars * 100) : null,
      cashDown: parsed.cashDownDollars != null ? Math.round(parsed.cashDownDollars * 100) : null,
      termMonths: parsed.termMonths ?? null,
      apr: parsed.aprPct != null ? Math.round(parsed.aprPct * 100) : null,
      backEndGross: parsed.backEndGrossDollars != null ? Math.round(parsed.backEndGrossDollars * 100) : 0,
      notes: parsed.notes || null,
    })
    .where(eq(schema.deals.id, dealId));

  revalidatePath(`/desk/deals/${dealId}`);
  revalidatePath("/desk/analytics");
}

export async function toggleStip(dealId: string, index: number) {
  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, dealId)).limit(1);
  if (!deal) return;
  const stips = [...deal.stips];
  if (!stips[index]) return;
  stips[index] = { ...stips[index], done: !stips[index].done };
  await db.update(schema.deals).set({ stips }).where(eq(schema.deals.id, dealId));
  revalidatePath(`/desk/deals/${dealId}`);
}

export async function setDealFunded(dealId: string, funded: boolean) {
  const today = todayInTimezone(await getDealershipTimezone());
  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, dealId)).limit(1);
  if (!deal) return;

  await db
    .update(schema.deals)
    .set({ funded, fundedOn: funded ? today : null })
    .where(eq(schema.deals.id, dealId));

  // Funding a deal is the moment the attached vehicle actually sold — keep
  // inventory's sold flag and the buy scorecard's turn-time data in sync
  // rather than making the operator flip both by hand.
  if (deal.vehicleId) {
    await db
      .update(schema.vehicles)
      .set({ sold: funded, soldOn: funded ? today : null })
      .where(eq(schema.vehicles.id, deal.vehicleId));
    revalidatePath("/inventory");
    revalidatePath("/sourcing/what-to-buy");
    revalidatePath("/sourcing/buy-scorecard");
  }

  revalidatePath(`/desk/deals/${dealId}`);
  revalidatePath("/desk/priority-queue");
}

export async function uploadDocument(dealId: string, formData: FormData) {
  const category = documentUploadSchema.parse({ category: formData.get("category") }).category;
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    throw new Error("No file selected");
  }

  const { storagePath, fileSize } = await saveFile(file);
  await db.insert(schema.documents).values({
    dealId,
    category,
    fileName: file.name,
    storagePath,
    mimeType: file.type || null,
    fileSize,
  });

  revalidatePath(`/desk/deals/${dealId}`);
}

export async function analyzeDocument(documentId: string, dealId: string) {
  const [doc] = await db.select().from(schema.documents).where(eq(schema.documents.id, documentId)).limit(1);
  if (!doc) return;

  if (!isExtractable(doc.category)) {
    await db
      .update(schema.documents)
      .set({
        extractionStatus: "failed",
        extractionError: "This document type isn't set up for extraction yet.",
        extractedAt: new Date(),
      })
      .where(eq(schema.documents.id, documentId));
    revalidatePath(`/desk/deals/${dealId}`);
    return;
  }

  await db
    .update(schema.documents)
    .set({ extractionStatus: "pending" })
    .where(eq(schema.documents.id, documentId));

  const fileBuffer = await readStoredFile(doc.storagePath);
  const result = await extractDocument(doc.category, fileBuffer, doc.mimeType);

  if (result.ok) {
    await db
      .update(schema.documents)
      .set({
        extractionStatus: "success",
        extractedData: result.data,
        extractedAt: new Date(),
        extractionError: null,
      })
      .where(eq(schema.documents.id, documentId));
  } else {
    await db
      .update(schema.documents)
      .set({
        extractionStatus: "failed",
        extractionError: result.error ?? "Unknown error",
        extractedAt: new Date(),
      })
      .where(eq(schema.documents.id, documentId));
  }

  revalidatePath(`/desk/deals/${dealId}`);
}

export async function deleteDocument(documentId: string, dealId: string) {
  await db.delete(schema.documents).where(eq(schema.documents.id, documentId));
  revalidatePath(`/desk/deals/${dealId}`);
}

export async function createAppointment(formData: FormData) {
  const parsed = appointmentSchema.parse({
    customerName: formData.get("customerName"),
    phone: formData.get("phone") ?? "",
    scheduledAt: formData.get("scheduledAt"),
    notes: formData.get("notes") ?? "",
    dealId: formData.get("dealId") ?? "",
  });

  await db.insert(schema.appointments).values({
    customerName: parsed.customerName,
    phone: parsed.phone || null,
    scheduledAt: new Date(parsed.scheduledAt),
    notes: parsed.notes || null,
    dealId: parsed.dealId || null,
  });

  revalidatePath("/desk/appointments");
  if (parsed.dealId) revalidatePath(`/desk/deals/${parsed.dealId}`);
}

export async function setAppointmentStatus(
  appointmentId: string,
  status: "scheduled" | "completed" | "canceled",
) {
  await db.update(schema.appointments).set({ status }).where(eq(schema.appointments.id, appointmentId));
  revalidatePath("/desk/appointments");
}
