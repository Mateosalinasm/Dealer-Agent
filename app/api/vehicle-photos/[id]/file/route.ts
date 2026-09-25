import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { readStoredFile } from "@/lib/storage";

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

  const buffer = await readStoredFile(storagePath);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mimeType || "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
