import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { bearerTokenFrom, verifyExtensionToken } from "@/lib/extension-auth";
import { marketplaceApproveSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// A human (via the dashboard, once built — Phase 3) approving a
// Claude-drafted reply, optionally editing its text first. This only ever
// moves a message from 'draft' to 'queued' — it does NOT send anything
// itself; the Messenger extension is what actually types it into Facebook
// and then calls /api/marketplace-agent/report to confirm.
export async function POST(req: NextRequest) {
  const token = await verifyExtensionToken(bearerTokenFrom(req));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = marketplaceApproveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const { messageId, body } = parsed.data;

  const [message] = await db.select().from(schema.messages).where(eq(schema.messages.id, messageId)).limit(1);
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  if (message.status !== "draft") return NextResponse.json({ error: `This message is already "${message.status}", not a pending draft.` }, { status: 409 });

  const [updated] = await db
    .update(schema.messages)
    .set({ status: "queued", approvedAt: new Date(), ...(body ? { body } : {}) })
    .where(eq(schema.messages.id, messageId))
    .returning();

  revalidatePath("/messages");
  return NextResponse.json({ ok: true, message: updated });
}
