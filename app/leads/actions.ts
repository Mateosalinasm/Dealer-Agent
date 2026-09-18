"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { leadSchema, leadStatusValues } from "@/lib/validation";

export async function createLead(formData: FormData) {
  const parsed = leadSchema.parse({
    name: formData.get("name"),
    phone: formData.get("phone") ?? "",
    source: formData.get("source") ?? "",
    wants: formData.get("wants") ?? "",
    wantMake: formData.get("wantMake") ?? "",
    wantModel: formData.get("wantModel") ?? "",
    maxMiles: formData.get("maxMiles") ?? "",
    maxPaymentDollars: formData.get("maxPaymentDollars") ?? "",
    downAvailableDollars: formData.get("downAvailableDollars") ?? "",
  });

  await db.insert(schema.leads).values({
    name: parsed.name,
    phone: parsed.phone || null,
    source: parsed.source || null,
    wants: parsed.wants || null,
    wantMake: parsed.wantMake || null,
    wantModel: parsed.wantModel || null,
    maxMiles: parsed.maxMiles ?? null,
    maxPayment: parsed.maxPaymentDollars != null ? Math.round(parsed.maxPaymentDollars * 100) : null,
    downAvailable: parsed.downAvailableDollars != null ? Math.round(parsed.downAvailableDollars * 100) : null,
  });

  revalidatePath("/leads");
  revalidatePath("/sourcing/run-list");
  revalidatePath("/sourcing/what-to-buy");
}

export async function setLeadStatus(leadId: string, status: (typeof leadStatusValues)[number]) {
  await db.update(schema.leads).set({ status }).where(eq(schema.leads.id, leadId));
  revalidatePath("/leads");
}

export async function deleteLead(leadId: string) {
  await db.delete(schema.leads).where(eq(schema.leads.id, leadId));
  revalidatePath("/leads");
}
