import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

// Shared plumbing for any code path that sends a WhatsApp message on the
// operator's behalf (not the human-in-the-loop composer in app/messages —
// that already does its own insert since it's a single, simple flow).
// Used by the sold/first-payment and referral automations
// (lib/deal-sold-automation.ts) so a conversation thread exists and shows
// the message the same way an inbound reply would, in /messages.

interface ConversationLinkOpts {
  name?: string | null;
  leadId?: string | null;
  dealId?: string | null;
}

async function findOrCreateConversation(phone: string, opts: ConversationLinkOpts) {
  const [existing] = await db.select().from(schema.conversations).where(eq(schema.conversations.contactPhone, phone)).limit(1);
  if (existing) {
    const patch: Partial<typeof schema.conversations.$inferInsert> = {};
    if (opts.dealId && !existing.dealId) patch.dealId = opts.dealId;
    if (opts.leadId && !existing.leadId) patch.leadId = opts.leadId;
    if (opts.name && !existing.contactName) patch.contactName = opts.name;
    if (Object.keys(patch).length === 0) return existing;
    await db.update(schema.conversations).set(patch).where(eq(schema.conversations.id, existing.id));
    return { ...existing, ...patch };
  }
  const [created] = await db
    .insert(schema.conversations)
    .values({ contactPhone: phone, contactName: opts.name ?? null, leadId: opts.leadId ?? null, dealId: opts.dealId ?? null })
    .returning();
  return created;
}

export interface SendAndLogResult {
  ok: boolean;
  error?: string;
}

/** Sends a WhatsApp message via Twilio and logs it into the matching conversation thread, win or lose. */
export async function sendAndLogAgentMessage(phone: string, body: string, opts: ConversationLinkOpts = {}): Promise<SendAndLogResult> {
  const conversation = await findOrCreateConversation(phone, opts);
  const result = await sendWhatsAppMessage(phone, body);

  await db.insert(schema.messages).values({
    conversationId: conversation.id,
    direction: "outbound",
    body,
    status: result.ok ? "sent" : "failed",
    providerMessageId: result.providerMessageId ?? null,
    sentByAgent: true,
  });
  await db.update(schema.conversations).set({ lastMessageAt: new Date() }).where(eq(schema.conversations.id, conversation.id));

  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
