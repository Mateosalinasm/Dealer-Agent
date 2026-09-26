import { asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { bearerTokenFrom, verifyExtensionToken } from "@/lib/extension-auth";

export const dynamic = "force-dynamic";

// Polled by the dashboard and/or the Messenger extension — every
// Claude-drafted reply still waiting on a human to approve or edit it
// (assist mode; there is no code path yet that skips this), oldest first
// so the operator naturally works through them in the order customers are
// waiting.
export async function GET(req: NextRequest) {
  const token = await verifyExtensionToken(bearerTokenFrom(req));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const drafts = await db
    .select({
      messageId: schema.messages.id,
      body: schema.messages.body,
      createdAt: schema.messages.createdAt,
      conversationId: schema.conversations.id,
      externalThreadId: schema.conversations.externalThreadId,
      contactName: schema.conversations.contactName,
      leadTemperature: schema.conversations.leadTemperature,
      needsHumanAttention: schema.conversations.needsHumanAttention,
      handoffReason: schema.conversations.handoffReason,
      vehicleId: schema.vehicles.id,
      vehicleYear: schema.vehicles.year,
      vehicleMake: schema.vehicles.make,
      vehicleModel: schema.vehicles.model,
    })
    .from(schema.messages)
    .innerJoin(schema.conversations, eq(schema.messages.conversationId, schema.conversations.id))
    .leftJoin(schema.vehicles, eq(schema.conversations.vehicleId, schema.vehicles.id))
    .where(eq(schema.messages.status, "draft"))
    .orderBy(asc(schema.messages.createdAt));

  return NextResponse.json({ drafts }, { headers: { "Cache-Control": "no-store" } });
}
