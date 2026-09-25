"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { saveBuffer, readStoredFile } from "@/lib/storage";
import { editVehiclePhoto as runPhotoEdit } from "@/lib/photo-editor";
import { normalizeToPhotoAspectRatio } from "@/lib/image-aspect";
import { MAX_VEHICLE_PHOTOS } from "@/lib/vehicle-photo-settings";
import type { VehiclePhotoEditSettings } from "@/schema-sketch/schema";

function extFor(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

export async function uploadVehiclePhotos(vehicleId: string, formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    return { ok: false, error: "No file selected." };
  }

  const existing = await db
    .select({ id: schema.vehiclePhotos.id })
    .from(schema.vehiclePhotos)
    .where(eq(schema.vehiclePhotos.vehicleId, vehicleId));

  if (existing.length >= MAX_VEHICLE_PHOTOS) {
    return { ok: false, error: `This vehicle already has the maximum of ${MAX_VEHICLE_PHOTOS} photos — delete one before adding more.` };
  }

  const room = MAX_VEHICLE_PHOTOS - existing.length;
  const accepted = files.slice(0, room);
  const skipped = files.length - accepted.length;
  let nextOrder = existing.length;

  for (const file of accepted) {
    try {
      const rawMimeType = file.type || "image/jpeg";
      const rawBuffer = Buffer.from(await file.arrayBuffer());
      // Normalize to the shared 3:4 canvas at upload time, not just for AI
      // edits — a landscape phone photo left as-is would still get cropped
      // unpredictably by the aspect-[3/4] display boxes everywhere else.
      const normalized = await normalizeToPhotoAspectRatio(rawBuffer, rawMimeType);
      const { storagePath } = await saveBuffer(normalized.buffer, normalized.mimeType, file.name || `photo.${extFor(normalized.mimeType)}`);
      await db.insert(schema.vehiclePhotos).values({
        vehicleId,
        originalStoragePath: storagePath,
        originalMimeType: normalized.mimeType,
        sortOrder: nextOrder++,
      });
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Upload failed — try again." };
    }
  }

  revalidatePath(`/inventory/${vehicleId}`);
  revalidatePath("/inventory");

  if (skipped > 0) {
    return { ok: true, error: `Added ${accepted.length} — this vehicle is capped at ${MAX_VEHICLE_PHOTOS} photos, so ${skipped} more didn't fit.` };
  }
  return { ok: true };
}

// Drives both the first "Edit with AI" click and every "Regenerate" after
// it — Regenerate is just this action re-run against the same original
// with (usually) the same settings, which is why editedStoragePath is
// simply overwritten rather than versioned; see the vehiclePhotos comment
// in schema-sketch/schema.ts.
export async function editVehiclePhotoAction(photoId: string, settings: VehiclePhotoEditSettings): Promise<{ ok: boolean; error?: string }> {
  const [photo] = await db.select().from(schema.vehiclePhotos).where(eq(schema.vehiclePhotos.id, photoId)).limit(1);
  if (!photo) return { ok: false, error: "Photo not found." };

  await db.update(schema.vehiclePhotos).set({ status: "processing" }).where(eq(schema.vehiclePhotos.id, photoId));
  revalidatePath(`/inventory/${photo.vehicleId}`);

  const buffer = await readStoredFile(photo.originalStoragePath);
  const result = await runPhotoEdit(buffer, photo.originalMimeType, settings);

  if (result.ok && result.imageBuffer && result.mimeType) {
    // Gemini doesn't reliably return a given aspect ratio, so normalize its
    // output to the same 4:3 canvas as everything else rather than trusting
    // whatever shape it produced this time.
    const normalized = await normalizeToPhotoAspectRatio(result.imageBuffer, result.mimeType);
    const { storagePath } = await saveBuffer(normalized.buffer, normalized.mimeType, `edited.${extFor(normalized.mimeType)}`);
    await db
      .update(schema.vehiclePhotos)
      .set({
        status: "edited",
        editedStoragePath: storagePath,
        editedMimeType: normalized.mimeType,
        editSettings: settings,
        editError: null,
        editedAt: new Date(),
      })
      .where(eq(schema.vehiclePhotos.id, photoId));
  } else {
    await db
      .update(schema.vehiclePhotos)
      .set({ status: "failed", editError: result.error ?? "Unknown error", editSettings: settings })
      .where(eq(schema.vehiclePhotos.id, photoId));
  }

  revalidatePath(`/inventory/${photo.vehicleId}`);
  return { ok: result.ok, error: result.error };
}

// Drag-to-reorder in the gallery — orderedPhotoIds is the full new order,
// front to back. sortOrder is what everything else (the inventory grid's
// cover photo, the gallery lightbox, list view) reads, so this is the only
// place that ever needs to change it. Scoped to vehicleId as well as id so
// a stale/tampered id list can't touch another vehicle's photos.
export async function reorderVehiclePhotos(vehicleId: string, orderedPhotoIds: string[]) {
  if (orderedPhotoIds.length === 0) return;
  await Promise.all(
    orderedPhotoIds.map((id, index) =>
      db
        .update(schema.vehiclePhotos)
        .set({ sortOrder: index })
        .where(and(eq(schema.vehiclePhotos.id, id), eq(schema.vehiclePhotos.vehicleId, vehicleId))),
    ),
  );
  revalidatePath(`/inventory/${vehicleId}`);
  revalidatePath("/inventory");
}

// "I don't like the edit, go back to the original" — clears every
// edit-related field so the photo's status and display fall straight back
// to the untouched upload, same as if it had never been edited. The
// generated file itself is left in storage (same as deleteVehiclePhoto
// already leaves orphaned files behind) — cheap enough for this volume
// that cleaning it up isn't worth the added complexity.
export async function revertVehiclePhoto(photoId: string) {
  const [photo] = await db
    .select({ vehicleId: schema.vehiclePhotos.vehicleId })
    .from(schema.vehiclePhotos)
    .where(eq(schema.vehiclePhotos.id, photoId))
    .limit(1);
  if (!photo) return;

  await db
    .update(schema.vehiclePhotos)
    .set({
      status: "uploaded",
      editedStoragePath: null,
      editedMimeType: null,
      editSettings: null,
      editError: null,
      editedAt: null,
    })
    .where(eq(schema.vehiclePhotos.id, photoId));

  revalidatePath(`/inventory/${photo.vehicleId}`);
  revalidatePath("/inventory");
}

export async function deleteVehiclePhoto(photoId: string) {
  const [photo] = await db
    .select({ vehicleId: schema.vehiclePhotos.vehicleId })
    .from(schema.vehiclePhotos)
    .where(eq(schema.vehiclePhotos.id, photoId))
    .limit(1);
  await db.delete(schema.vehiclePhotos).where(eq(schema.vehiclePhotos.id, photoId));
  if (photo) revalidatePath(`/inventory/${photo.vehicleId}`);
}
