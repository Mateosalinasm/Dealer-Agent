import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { readStoredFile, overwriteStoredFile } from "@/lib/storage";
import { normalizeToPhotoAspectRatio } from "@/lib/image-aspect";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const wantEdited = req.nextUrl.searchParams.get("v") === "edited";

  const [photo] = await db.select().from(schema.vehiclePhotos).where(eq(schema.vehiclePhotos.id, id)).limit(1);
  if (!photo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const storagePath = wantEdited ? photo.editedStoragePath : photo.originalStoragePath;
  const mimeType = wantEdited ? photo.editedMimeType : photo.originalMimeType;
  if (!storagePath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let buffer = await readStoredFile(storagePath);

  // Self-heal: photos uploaded/edited before the 4:3 aspect-ratio pass
  // existed (or from before this route did this check) never got
  // normalized — this fixes them the first time they're actually viewed,
  // rather than needing a one-off backfill script run against every photo
  // in storage. normalizeToPhotoAspectRatio is a fast no-op (same buffer
  // reference back) for anything already normalized, so this costs
  // nothing on every subsequent read of the same photo.
  const normalized = await normalizeToPhotoAspectRatio(buffer, mimeType || "image/jpeg");
  let outMimeType = mimeType;
  if (normalized.buffer !== buffer) {
    try {
      await overwriteStoredFile(storagePath, normalized.buffer, normalized.mimeType);
    } catch {
      // Best-effort — still serve the corrected bytes to this request even
      // if persisting them back failed (e.g. a transient storage error).
    }
    buffer = normalized.buffer;
    outMimeType = normalized.mimeType;
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": outMimeType || "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
