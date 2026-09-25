import JSZip from "jszip";

function extFromMimeType(mimeType: string | null): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

// Fetches each photo's currently-displayed version (edited if it has one,
// otherwise the original) as a blob, zips them client-side, and triggers a
// normal browser download — no server round-trip needed beyond the image
// fetches themselves, which already go through /api/vehicle-photos/[id]/file.
export async function downloadPhotosAsZip(
  photos: { url: string; mimeType: string | null }[],
  zipFileName: string,
): Promise<void> {
  if (photos.length === 0) return;
  const zip = new JSZip();

  await Promise.all(
    photos.map(async (photo, index) => {
      const res = await fetch(photo.url);
      const blob = await res.blob();
      zip.file(`photo-${index + 1}.${extFromMimeType(photo.mimeType)}`, blob);
    }),
  );

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipFileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
