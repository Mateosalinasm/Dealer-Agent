"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { lenderSchema, programSchema } from "@/lib/validation";

function parseProgramForm(formData: FormData) {
  return programSchema.parse({
    label: formData.get("label"),
    advancePct: formData.get("advancePct"),
    maxLtvPct: formData.get("maxLtvPct") ?? "",
    maxTermMonths: formData.get("maxTermMonths") ?? "",
    maxMiles: formData.get("maxMiles") ?? "",
    maxAgeYears: formData.get("maxAgeYears") ?? "",
    acquisitionFeeDollars: formData.get("acquisitionFeeDollars") ?? "",
    minCreditScore: formData.get("minCreditScore") ?? "",
    maxPtiPct: formData.get("maxPtiPct") ?? "",
    typicalAprPct: formData.get("typicalAprPct") ?? "",
    allowedTitles: formData.getAll("allowedTitles"),
    notes: formData.get("notes") ?? "",
  });
}

export async function createLender(formData: FormData) {
  const parsed = lenderSchema.parse({
    name: formData.get("name"),
    contact: formData.get("contact") ?? "",
    notes: formData.get("notes") ?? "",
  });
  await db.insert(schema.lenders).values({
    name: parsed.name,
    contact: parsed.contact || null,
    notes: parsed.notes || null,
  });
  revalidatePath("/lenders");
}

export async function updateLender(lenderId: string, formData: FormData) {
  const parsed = lenderSchema.parse({
    name: formData.get("name"),
    contact: formData.get("contact") ?? "",
    notes: formData.get("notes") ?? "",
  });
  await db
    .update(schema.lenders)
    .set({ name: parsed.name, contact: parsed.contact || null, notes: parsed.notes || null })
    .where(eq(schema.lenders.id, lenderId));
  revalidatePath("/lenders");
}

export async function setLenderActive(lenderId: string, active: boolean) {
  await db.update(schema.lenders).set({ active }).where(eq(schema.lenders.id, lenderId));
  revalidatePath("/lenders");
}

export async function deleteLender(lenderId: string) {
  await db.delete(schema.lenders).where(eq(schema.lenders.id, lenderId));
  revalidatePath("/lenders");
}

export async function createProgram(lenderId: string, formData: FormData) {
  const p = parseProgramForm(formData);
  await db.insert(schema.lenderPrograms).values({
    lenderId,
    label: p.label,
    advancePct: p.advancePct,
    maxLtvPct: p.maxLtvPct ?? null,
    maxTermMonths: p.maxTermMonths ?? null,
    maxMiles: p.maxMiles ?? null,
    maxAgeYears: p.maxAgeYears ?? null,
    acquisitionFee: p.acquisitionFeeDollars != null ? Math.round(p.acquisitionFeeDollars * 100) : 0,
    minCreditScore: p.minCreditScore ?? null,
    maxPtiPct: p.maxPtiPct ?? null,
    typicalAprBps: p.typicalAprPct != null ? Math.round(p.typicalAprPct * 100) : null,
    allowedTitles: p.allowedTitles && p.allowedTitles.length > 0 ? p.allowedTitles : null,
    notes: p.notes || null,
  });
  revalidatePath("/lenders");
}

export async function updateProgram(programId: string, formData: FormData) {
  const p = parseProgramForm(formData);
  await db
    .update(schema.lenderPrograms)
    .set({
      label: p.label,
      advancePct: p.advancePct,
      maxLtvPct: p.maxLtvPct ?? null,
      maxTermMonths: p.maxTermMonths ?? null,
      maxMiles: p.maxMiles ?? null,
      maxAgeYears: p.maxAgeYears ?? null,
      acquisitionFee: p.acquisitionFeeDollars != null ? Math.round(p.acquisitionFeeDollars * 100) : 0,
      minCreditScore: p.minCreditScore ?? null,
      maxPtiPct: p.maxPtiPct ?? null,
      typicalAprBps: p.typicalAprPct != null ? Math.round(p.typicalAprPct * 100) : null,
      allowedTitles: p.allowedTitles && p.allowedTitles.length > 0 ? p.allowedTitles : null,
      notes: p.notes || null,
    })
    .where(eq(schema.lenderPrograms.id, programId));
  revalidatePath("/lenders");
}

export async function deleteProgram(programId: string) {
  await db.delete(schema.lenderPrograms).where(eq(schema.lenderPrograms.id, programId));
  revalidatePath("/lenders");
}
