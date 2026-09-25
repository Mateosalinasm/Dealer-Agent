import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { bearerTokenFrom, verifyExtensionToken } from "@/lib/extension-auth";
import { autoPostReportSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// Called by the extension after it attempts a listing — either it worked
// (dequeue, record the listing URL, mark the vehicle posted, same as the
// manual "Mark posted" button) or it didn't (dequeue anyway; a failed
// attempt is never silently retried against Facebook — the operator has
// to look at the error and re-queue on purpose, see
// components/marketing-detail-panel.tsx).
export async function POST(req: NextRequest) {
  const token = await verifyExtensionToken(bearerTokenFrom(req));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = autoPostReportSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const { postId, ok, error, listingUrl } = parsed.data;

  const [post] = await db.select().from(schema.marketingPosts).where(eq(schema.marketingPosts.id, postId)).limit(1);
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  if (ok) {
    await db
      .update(schema.marketingPosts)
      .set({ postedAt: new Date(), postedVia: "auto", queuedForAutoPost: false, autoPostError: null, externalListingUrl: listingUrl ?? null })
      .where(eq(schema.marketingPosts.id, postId));
    await db.update(schema.vehicles).set({ marketingStatus: "posted" }).where(eq(schema.vehicles.id, post.vehicleId));
  } else {
    await db
      .update(schema.marketingPosts)
      .set({ queuedForAutoPost: false, autoPostError: error || "The extension reported a failure with no details." })
      .where(eq(schema.marketingPosts.id, postId));
  }

  revalidatePath("/marketing");
  return NextResponse.json({ ok: true });
}
