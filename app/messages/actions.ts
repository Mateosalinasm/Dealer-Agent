"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { normalizePhone } from "@/lib/phone";

export async function sendMessage(conversationId: string, formData: FormData) {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  const [conversation] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, conversationId)).limit(1);
  if (!conversation) return;

  const result = await sendWhatsAppMessage(conversation.contactPhone, body);

  await db.insert(schema.messages).values({
    conversationId,
    direction: "outbound",
    body,
    status: result.ok ? "sent" : "failed",
    providerMessageId: result.providerMessageId ?? null,
  });

  await db.update(schema.conversations).set({ lastMessageAt: new Date() }).where(eq(schema.conversations.id, conversationId));

  revalidatePath("/messages");
  return result.ok ? null : result.error;
}

export async function markConversationRead(conversationId: string) {
  await db.update(schema.conversations).set({ unreadCount: 0 }).where(eq(schema.conversations.id, conversationId));
  revalidatePath("/messages");
}

export async function startConversation(formData: FormData) {
  const phoneRaw = String(formData.get("phone") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const phone = normalizePhone(phoneRaw);
  if (!phone) return;

  const [existing] = await db.select().from(schema.conversations).where(eq(schema.conversations.contactPhone, phone)).limit(1);
  if (existing) {
    redirect(`/messages?c=${existing.id}`);
  }

  const [conversation] = await db
    .insert(schema.conversations)
    .values({ contactPhone: phone, contactName: name || null })
    .returning();

  revalidatePath("/messages");
  redirect(`/messages?c=${conversation.id}`);
}
