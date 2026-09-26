import { and, asc, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { bearerTokenFrom, verifyExtensionToken } from "@/lib/extension-auth";
import { marketplaceInboundSchema } from "@/lib/validation";
import { generateMarketplaceReply, type VehicleForAgent } from "@/lib/marketplace-agent";

export const dynamic = "force-dynamic";

// Called by the Messenger extension whenever it sees a new customer
// message on a Facebook Marketplace conversation. Unlike the WhatsApp
// webhook (Twilio calls that one directly, so its identity is the request
// itself), this is called by our own extension — bearer-token authed the
// same way as the Facebook-posting extension, and reusing the exact same
// token mechanism (see lib/extension-auth.ts) since it's already
// provider-agnostic.
export async function POST(req: NextRequest) {
  const token = await verifyExtensionToken(bearerTokenFrom(req));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = marketplaceInboundSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const { externalThreadId, vehicleId, listingUrl, contactName, body } = parsed.data;

  // The extension only reliably has the listing URL Facebook shows in the
  // conversation header — not this app's own vehicle id — so resolve
  // through marketing_posts when vehicleId itself wasn't given.
  let resolvedVehicleId = vehicleId ?? null;
  if (!resolvedVehicleId && listingUrl) {
    const [post] = await db.select({ vehicleId: schema.marketingPosts.vehicleId }).from(schema.marketingPosts).where(eq(schema.marketingPosts.externalListingUrl, listingUrl)).limit(1);
    resolvedVehicleId = post?.vehicleId ?? null;
  }
  if (!resolvedVehicleId) {
    return NextResponse.json({ error: "Could not resolve which vehicle this conversation is about — pass vehicleId or a listingUrl that matches a posted listing." }, { status: 400 });
  }

  const [vehicle] = await db.select().from(schema.vehicles).where(eq(schema.vehicles.id, resolvedVehicleId)).limit(1);
  if (!vehicle) return NextResponse.json({ error: "That vehicle no longer exists." }, { status: 404 });

  let [conversation] = await db
    .select()
    .from(schema.conversations)
    .where(and(eq(schema.conversations.channel, "facebook_marketplace"), eq(schema.conversations.externalThreadId, externalThreadId)))
    .limit(1);

  if (!conversation) {
    [conversation] = await db
      .insert(schema.conversations)
      .values({ channel: "facebook_marketplace", externalThreadId, vehicleId: resolvedVehicleId, contactName: contactName || null })
      .returning();
  }

  // The extension re-reads the whole visible thread on every poll, not
  // just genuinely new messages, so the same inbound text can easily show
  // up again on the next check — only treat it as new if it doesn't match
  // what's already the last message here.
  const [lastMessage] = await db.select().from(schema.messages).where(eq(schema.messages.conversationId, conversation.id)).orderBy(desc(schema.messages.createdAt)).limit(1);
  if (lastMessage?.direction === "inbound" && lastMessage.body === body) {
    return NextResponse.json({ ok: true, conversationId: conversation.id, duplicate: true });
  }

  const [inboundMessage] = await db
    .insert(schema.messages)
    .values({ conversationId: conversation.id, direction: "inbound", body, status: "delivered" })
    .returning();

  await db
    .update(schema.conversations)
    .set({
      lastMessageAt: new Date(),
      unreadCount: conversation.unreadCount + 1,
      contactName: conversation.contactName ?? contactName ?? null,
    })
    .where(eq(schema.conversations.id, conversation.id));

  const [settingsRow] = await db.select().from(schema.settings).limit(1);
  if (!settingsRow?.marketplaceAgentEnabled) {
    revalidatePath("/messages");
    return NextResponse.json({ ok: true, conversationId: conversation.id, messageId: inboundMessage.id, draft: null, reason: "agent_disabled" });
  }

  const priorMessages = await db.select().from(schema.messages).where(eq(schema.messages.conversationId, conversation.id)).orderBy(asc(schema.messages.createdAt));
  const history = priorMessages.filter((m) => m.id !== inboundMessage.id).map((m) => ({ direction: m.direction, body: m.body }));

  const vehicleForAgent: VehicleForAgent = {
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
    trim: vehicle.trim,
    color: vehicle.color,
    miles: vehicle.miles,
    askingPrice: vehicle.askingPrice,
    bodyType: vehicle.bodyType,
    fuelType: vehicle.fuelType,
    isThreeRowSuv: vehicle.isThreeRowSuv,
    sold: vehicle.sold,
  };

  const result = await generateMarketplaceReply({ vehicle: vehicleForAgent, history, latestMessage: body });
  if (!result.ok) {
    revalidatePath("/messages");
    return NextResponse.json({ ok: true, conversationId: conversation.id, messageId: inboundMessage.id, draft: null, error: result.error });
  }

  await db.update(schema.messages).set({ intent: result.data.intent }).where(eq(schema.messages.id, inboundMessage.id));

  const [draftMessage] = await db
    .insert(schema.messages)
    .values({ conversationId: conversation.id, direction: "outbound", body: result.data.reply, status: "draft", sentByAgent: true })
    .returning();

  await db
    .update(schema.conversations)
    .set({
      leadTemperature: result.data.leadTemperature,
      needsHumanAttention: result.data.needsHandoff,
      handoffReason: result.data.needsHandoff ? result.data.handoffReason : null,
    })
    .where(eq(schema.conversations.id, conversation.id));

  revalidatePath("/messages");
  return NextResponse.json({
    ok: true,
    conversationId: conversation.id,
    messageId: inboundMessage.id,
    draft: { id: draftMessage.id, body: draftMessage.body },
    intent: result.data.intent,
    leadTemperature: result.data.leadTemperature,
    needsHandoff: result.data.needsHandoff,
  });
}
