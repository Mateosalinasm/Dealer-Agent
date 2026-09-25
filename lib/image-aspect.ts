import "server-only";
import sharp from "sharp";

// Every vehicle photo the UI shows — the inventory grid's cover thumbnail,
// the gallery lightbox, the photo section's cards — is displayed in an
// aspect-[4/3] box. Before this module existed, that box just cropped
// whatever shape the source photo happened to be (a portrait phone photo,
// a wide AI-generated landscape shot) via object-cover, so the vehicle
// ended up zoomed in or out inconsistently from one photo to the next.
// Normalizing every stored photo — original upload AND AI edit — to this
// exact canvas up front means the CSS box never has to crop unpredictably
// again; it's already the right shape.
export const PHOTO_ASPECT_RATIO = 4 / 3;
const TARGET_WIDTH = 1600;
const TARGET_HEIGHT = Math.round(TARGET_WIDTH / PHOTO_ASPECT_RATIO);
const RATIO_TOLERANCE = 0.02;

type NormalizedFormat = "jpeg" | "png" | "webp";

function formatFor(mimeType: string): { format: NormalizedFormat; outMimeType: string } {
  if (mimeType === "image/png") return { format: "png", outMimeType: "image/png" };
  if (mimeType === "image/webp") return { format: "webp", outMimeType: "image/webp" };
  return { format: "jpeg", outMimeType: "image/jpeg" };
}

// A source that doesn't natively fill 4:3 — a portrait phone photo, a
// square AI output — gets composited onto a softly blurred, darkened,
// scaled-up copy of itself rather than stretched (which would distort the
// vehicle) or letterboxed with hard bars (which would look unfinished).
// This is the "blurred backdrop" technique used for portrait photos in
// square/landscape feeds — no second AI generation call needed, so it's
// free and instant next to the real per-photo Gemini edit.
export async function normalizeToPhotoAspectRatio(buffer: Buffer, mimeType: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const { format, outMimeType } = formatFor(mimeType);
  const encodeOpts = format === "jpeg" ? { quality: 88 } : format === "webp" ? { quality: 88 } : undefined;

  // Cheap header-only read first — a buffer already at exactly the target
  // canvas (every prior pass through this function lands here) needs no
  // further work. This is what lets the photo-serving route self-heal old
  // un-normalized photos on read (see app/api/vehicle-photos/[id]/file)
  // without re-encoding an already-fixed JPEG on every single request
  // forever, which would slowly degrade it — JPEG re-encoding is lossy.
  // Returning the exact same buffer reference lets a caller detect "no
  // change was needed" with a cheap `result.buffer === input` check.
  const rawMeta = await sharp(buffer, { failOn: "none" }).metadata();
  if (rawMeta.width === TARGET_WIDTH && rawMeta.height === TARGET_HEIGHT) {
    return { buffer, mimeType: outMimeType };
  }

  const meta = await sharp(buffer, { failOn: "none" }).rotate().metadata();
  if (!meta.width || !meta.height) return { buffer, mimeType: outMimeType };

  const ratio = meta.width / meta.height;
  if (Math.abs(ratio - PHOTO_ASPECT_RATIO) < RATIO_TOLERANCE) {
    const out = await sharp(buffer, { failOn: "none" })
      .rotate()
      .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: "cover" })
      .toFormat(format, encodeOpts)
      .toBuffer();
    return { buffer: out, mimeType: outMimeType };
  }

  const backgroundBuf = await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: "cover" })
    .blur(48)
    .modulate({ brightness: 0.72 })
    .toBuffer();

  const foregroundBuf = await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: "inside" })
    .toBuffer();
  const fgMeta = await sharp(foregroundBuf).metadata();
  const fgWidth = fgMeta.width ?? TARGET_WIDTH;
  const fgHeight = fgMeta.height ?? TARGET_HEIGHT;

  const out = await sharp(backgroundBuf)
    .composite([{ input: foregroundBuf, left: Math.round((TARGET_WIDTH - fgWidth) / 2), top: Math.round((TARGET_HEIGHT - fgHeight) / 2) }])
    .toFormat(format, encodeOpts)
    .toBuffer();

  return { buffer: out, mimeType: outMimeType };
}
