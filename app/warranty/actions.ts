"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { warrantyProductSchema } from "@/lib/validation";

function parseForm(formData: FormData) {
  return warrantyProductSchema.parse({
    name: formData.get("name"),
    provider: formData.get("provider"),
    productType: formData.get("productType"),
    costDollars: formData.get("costDollars"),
    priceDollars: formData.get("priceDollars"),
    termMonths: formData.get("termMonths") ?? "",
    termMiles: formData.get("termMiles") ?? "",
    deductibleDollars: formData.get("deductibleDollars") ?? "",
    maxVehicleAgeYears: formData.get("maxVehicleAgeYears") ?? "",
    maxVehicleMiles: formData.get("maxVehicleMiles") ?? "",
    minSalePriceDollars: formData.get("minSalePriceDollars") ?? "",
    maxSalePriceDollars: formData.get("maxSalePriceDollars") ?? "",
    notes: formData.get("notes") ?? "",
  });
}

export async function createWarrantyProduct(formData: FormData) {
  const p = parseForm(formData);
  await db.insert(schema.warrantyProducts).values({
    name: p.name,
    provider: p.provider,
    productType: p.productType,
    costCents: Math.round(p.costDollars * 100),
    priceCents: Math.round(p.priceDollars * 100),
    termMonths: p.termMonths ?? null,
    termMiles: p.termMiles ?? null,
    deductibleCents: p.deductibleDollars != null ? Math.round(p.deductibleDollars * 100) : null,
    maxVehicleAgeYears: p.maxVehicleAgeYears ?? null,
    maxVehicleMiles: p.maxVehicleMiles ?? null,
    minSalePriceCents: p.minSalePriceDollars != null ? Math.round(p.minSalePriceDollars * 100) : null,
    maxSalePriceCents: p.maxSalePriceDollars != null ? Math.round(p.maxSalePriceDollars * 100) : null,
    notes: p.notes || null,
  });
  revalidatePath("/warranty");
}

export async function updateWarrantyProduct(productId: string, formData: FormData) {
  const p = parseForm(formData);
  await db
    .update(schema.warrantyProducts)
    .set({
      name: p.name,
      provider: p.provider,
      productType: p.productType,
      costCents: Math.round(p.costDollars * 100),
      priceCents: Math.round(p.priceDollars * 100),
      termMonths: p.termMonths ?? null,
      termMiles: p.termMiles ?? null,
      deductibleCents: p.deductibleDollars != null ? Math.round(p.deductibleDollars * 100) : null,
      maxVehicleAgeYears: p.maxVehicleAgeYears ?? null,
      maxVehicleMiles: p.maxVehicleMiles ?? null,
      minSalePriceCents: p.minSalePriceDollars != null ? Math.round(p.minSalePriceDollars * 100) : null,
      maxSalePriceCents: p.maxSalePriceDollars != null ? Math.round(p.maxSalePriceDollars * 100) : null,
      notes: p.notes || null,
    })
    .where(eq(schema.warrantyProducts.id, productId));
  revalidatePath("/warranty");
}

export async function setWarrantyProductActive(productId: string, active: boolean) {
  await db.update(schema.warrantyProducts).set({ active }).where(eq(schema.warrantyProducts.id, productId));
  revalidatePath("/warranty");
}

export async function deleteWarrantyProduct(productId: string) {
  await db.delete(schema.warrantyProducts).where(eq(schema.warrantyProducts.id, productId));
  revalidatePath("/warranty");
}
