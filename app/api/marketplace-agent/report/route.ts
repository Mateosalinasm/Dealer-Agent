import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { bearerTokenFrom, verifyExtensionToken } from "@/lib/extension-auth";
import { marketplaceReportSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// Called by the Messenger extension after it attempts to actually send an
// approved (status 'queued') reply in the real Facebook UI — mirrors
// app/api/extension/report/route.ts's role for the listing-poster
// extension. A failed send is never silently retried; it's left for a
// human to notice and re-approve on purpose.
export async function POST(req: NextRequest) {
  const token = await verifyExtensionToken(bearerTokenFrom(req));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = marketplaceReportSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const { messageId, ok, providerMessageId } = parsed.data;

  const [message] = await db.select().from(schema.messages).where(eq(schema.messages.id, messageId)).limit(1);
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  await db
    .update(schema.messages)
    .set({ status: ok ? "sent" : "failed", providerMessageId: providerMessageId ?? null })
    .where(eq(schema.messages.id, messageId));

  if (ok) {
    await db.update(schema.conversations).set({ lastMessageAt: new Date() }).where(eq(schema.conversations.id, message.conversationId));
  }

  revalidatePath("/messages");
  return NextResponse.json({ ok: true });
}
