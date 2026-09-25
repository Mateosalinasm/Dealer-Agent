"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { generateListingCopy } from "@/lib/marketing-copy";
import { leadSchema } from "@/lib/validation";
import type { marketingLanguage, marketingPlatform, marketingStatus } from "@/schema-sketch/schema";

async function getVehicle(vehicleId: string) {
  const [vehicle] = await db.select().from(schema.vehicles).where(eq(schema.vehicles.id, vehicleId)).limit(1);
  if (!vehicle) throw new Error("Vehicle not found");
  return vehicle;
}

async function upsertPost(vehicleId: string, platform: (typeof marketingPlatform)[number], language: (typeof marketingLanguage)[number], body: string) {
  const [existing] = await db
    .select()
    .from(schema.marketingPosts)
    .where(and(eq(schema.marketingPosts.vehicleId, vehicleId), eq(schema.marketingPosts.platform, platform), eq(schema.marketingPosts.language, language)))
    .limit(1);

  if (existing) {
    await db.update(schema.marketingPosts).set({ body, updatedAt: new Date() }).where(eq(schema.marketingPosts.id, existing.id));
  } else {
    await db.insert(schema.marketingPosts).values({ vehicleId, platform, language, body });
  }
}

export async function generateListing(
  vehicleId: string,
  platform: (typeof marketingPlatform)[number],
  language: (typeof marketingLanguage)[number],
): Promise<{ ok: boolean; text?: string; error?: string }> {
  const vehicle = await getVehicle(vehicleId);

  const result = await generateListingCopy({
    vehicle: {
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      trim: vehicle.trim,
      color: vehicle.color,
      askingPrice: vehicle.askingPrice,
      bodyType: vehicle.bodyType,
      fuelType: vehicle.fuelType,
      isThreeRowSuv: vehicle.isThreeRowSuv,
    },
    platform,
    language,
  });

  if (!result.ok || !result.text) return { ok: false, error: result.error };

  await upsertPost(vehicleId, platform, language, result.text);
  if (vehicle.marketingStatus === "not_marketed") {
    await db.update(schema.vehicles).set({ marketingStatus: "ready_to_post" }).where(eq(schema.vehicles.id, vehicleId));
  }

  revalidatePath("/marketing");
  return { ok: true, text: result.text };
}

export async function updateListingBody(
  vehicleId: string,
  platform: (typeof marketingPlatform)[number],
  language: (typeof marketingLanguage)[number],
  body: string,
) {
  await upsertPost(vehicleId, platform, language, body);
  revalidatePath("/marketing");
}

export async function markPosted(vehicleId: string, platform: (typeof marketingPlatform)[number], language: (typeof marketingLanguage)[number]) {
  const [existing] = await db
    .select()
    .from(schema.marketingPosts)
    .where(and(eq(schema.marketingPosts.vehicleId, vehicleId), eq(schema.marketingPosts.platform, platform), eq(schema.marketingPosts.language, language)))
    .limit(1);

  if (existing) {
    await db.update(schema.marketingPosts).set({ postedAt: new Date() }).where(eq(schema.marketingPosts.id, existing.id));
  } else {
    await db.insert(schema.marketingPosts).values({ vehicleId, platform, language, postedAt: new Date() });
  }

  await db.update(schema.vehicles).set({ marketingStatus: "posted" }).where(eq(schema.vehicles.id, vehicleId));
  revalidatePath("/marketing");
}

export async function queueForAutoPost(
  vehicleId: string,
  platform: (typeof marketingPlatform)[number],
  language: (typeof marketingLanguage)[number],
): Promise<{ ok: boolean; error?: string }> {
  const [existing] = await db
    .select()
    .from(schema.marketingPosts)
    .where(and(eq(schema.marketingPosts.vehicleId, vehicleId), eq(schema.marketingPosts.platform, platform), eq(schema.marketingPosts.language, language)))
    .limit(1);

  if (!existing?.body) return { ok: false, error: "Write the listing before queuing it to auto-post." };
  if (existing.postedAt) return { ok: false, error: "Already posted — mark it in stock again first if you want to re-post." };

  await db
    .update(schema.marketingPosts)
    .set({ queuedForAutoPost: true, queuedAt: new Date(), autoPostError: null })
    .where(eq(schema.marketingPosts.id, existing.id));

  revalidatePath("/marketing");
  return { ok: true };
}

export async function unqueueAutoPost(vehicleId: string, platform: (typeof marketingPlatform)[number], language: (typeof marketingLanguage)[number]) {
  await db
    .update(schema.marketingPosts)
    .set({ queuedForAutoPost: false })
    .where(and(eq(schema.marketingPosts.vehicleId, vehicleId), eq(schema.marketingPosts.platform, platform), eq(schema.marketingPosts.language, language)));
  revalidatePath("/marketing");
}

export async function setMarketingStatus(vehicleId: string, status: (typeof marketingStatus)[number]) {
  await db.update(schema.vehicles).set({ marketingStatus: status }).where(eq(schema.vehicles.id, vehicleId));
  revalidatePath("/marketing");
}

export async function updateVehicleMarketingFacts(
  vehicleId: string,
  facts: { bodyType: "truck" | "sedan" | "suv" | ""; fuelType: "gas" | "diesel" | "hybrid" | "electric"; isThreeRowSuv: boolean },
) {
  await db
    .update(schema.vehicles)
    .set({ bodyType: facts.bodyType || null, fuelType: facts.fuelType, isThreeRowSuv: facts.isThreeRowSuv })
    .where(eq(schema.vehicles.id, vehicleId));
  revalidatePath("/marketing");
}

export async function logLeadFromVehicle(vehicleId: string, formData: FormData) {
  const vehicle = await getVehicle(vehicleId);
  const parsed = leadSchema.parse({
    name: formData.get("name"),
    phone: formData.get("phone") ?? "",
    source: "Facebook Marketplace",
    wantMake: vehicle.make ?? "",
    wantModel: vehicle.model ?? "",
  });

  await db.insert(schema.leads).values({
    name: parsed.name,
    phone: parsed.phone || null,
    source: parsed.source || null,
    wantMake: parsed.wantMake || null,
    wantModel: parsed.wantModel || null,
  });

  await db.update(schema.vehicles).set({ marketingStatus: "lead_generated" }).where(eq(schema.vehicles.id, vehicleId));

  revalidatePath("/marketing");
  revalidatePath("/leads");
}
