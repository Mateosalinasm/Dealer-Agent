import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { verifyTwilioSignature } from "@/lib/whatsapp";

// Twilio's inbound-message webhook. Configure this URL (https://<your
// domain>/api/whatsapp/webhook) as the WhatsApp sender's "when a message
// comes in" webhook in the Twilio console. Twilio POSTs
// application/x-www-form-urlencoded — never JSON — with From/To/Body/
// MessageSid among the fields.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody));

  // Reject anything that isn't provably from Twilio before touching the
  // database — this URL is public the moment it's configured.
  const signature = req.headers.get("x-twilio-signature");
  if (!verifyTwilioSignature(req.url, params, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const fromRaw = params.From?.replace(/^whatsapp:/, "");
  const body = params.Body;
  const messageSid = params.MessageSid;
  const profileName = params.ProfileName;
  const phone = normalizePhone(fromRaw);
  if (!phone || !body) {
    return new NextResponse("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
  }

  let [conversation] = await db.select().from(schema.conversations).where(eq(schema.conversations.contactPhone, phone)).limit(1);

  if (!conversation) {
    // Best-effort link to a lead with a matching phone number — leads
    // aren't stored E.164-normalized, so this compares normalized forms
    // client-side rather than in SQL. Fine at dealership scale.
    const leads = await db.select({ id: schema.leads.id, phone: schema.leads.phone }).from(schema.leads);
    const matchedLead = leads.find((l) => normalizePhone(l.phone) === phone);

    [conversation] = await db
      .insert(schema.conversations)
      .values({
        contactPhone: phone,
        contactName: profileName || null,
        leadId: matchedLead?.id ?? null,
      })
      .returning();
  }

  await db.insert(schema.messages).values({
    conversationId: conversation.id,
    direction: "inbound",
    body,
    status: "delivered",
    providerMessageId: messageSid || null,
  });

  await db
    .update(schema.conversations)
    .set({
      lastMessageAt: new Date(),
      unreadCount: conversation.unreadCount + 1,
      contactName: conversation.contactName ?? profileName ?? null,
    })
    .where(eq(schema.conversations.id, conversation.id));

  revalidatePath("/messages");

  // Empty TwiML — no auto-reply. See NOTES_FOR_MATEO.md for the AI-agent-
  // reply decision this is deliberately not making on its own.
  return new NextResponse("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
}
