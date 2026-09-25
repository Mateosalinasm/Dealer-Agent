// Client-only. Phone camera photos routinely run 3-10MB — comfortably over
// both Next's Server Action body limit and Vercel's hard, non-configurable
// 4.5MB serverless request ceiling (see next.config.ts). Downsizing before
// upload is what actually makes vehicle-photo uploads reliable regardless
// of what a given phone produces, rather than just nudging the config
// limits closer to that ceiling. Re-encodes everything as JPEG — fine for
// a dealership listing photo, and guarantees real compression regardless
// of the original format (a large PNG screenshot wouldn't shrink much
// otherwise).
export async function resizeImageForUpload(file: File, maxDimension = 2400, quality = 0.85): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) return file;

  // Only worth it if it actually shrank the file — a small source image
  // upscaled/re-encoded can occasionally come out larger.
  if (blob.size >= file.size) return file;

  const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg" });
}
