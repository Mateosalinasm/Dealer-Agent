import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

// The one function every intake channel should call before writing a lead,
// deal, or appointment. Phone is the identity key — WhatsApp already hands
// us one (E.164) on every inbound message, so there's nothing to ask the
// customer. Other channels normalize to the same shape before calling this.
export interface ContactInput {
  phone: string; // E.164, e.g. "+15551234567"
  name?: string;
  email?: string;
  channel?: string; // "whatsapp" | "facebook" | "instagram" | "website" | "walk-in" | "phone"
}

export async function findOrCreateContact(input: ContactInput) {
  const [existing] = await db.select().from(schema.contacts).where(eq(schema.contacts.phone, input.phone)).limit(1);
  if (existing) {
    // Fill in anything we learn later (a name given mid-conversation) without
    // clobbering what's already there.
    if (input.name && !existing.name) {
      await db.update(schema.contacts).set({ name: input.name }).where(eq(schema.contacts.id, existing.id));
      return { ...existing, name: input.name };
    }
    return existing;
  }

  const [created] = await db
    .insert(schema.contacts)
    .values({
      phone: input.phone,
      name: input.name || null,
      email: input.email || null,
      preferredChannel: input.channel || null,
      source: input.channel || null,
    })
    .returning();
  return created;
}
