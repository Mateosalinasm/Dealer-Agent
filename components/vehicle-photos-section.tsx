"use client";

import { useRef, useState, useTransition } from "react";
import type { DragEvent } from "react";
import { ImagePlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { UploadingLabel } from "@/components/uploading-indicator";
import { VehiclePhotoCard, type VehiclePhotoDTO } from "@/components/vehicle-photo-card";
import { VehicleEditAllButton } from "@/components/vehicle-edit-all-button";
import { uploadVehiclePhotos, reorderVehiclePhotos } from "@/app/inventory/photo-actions";
import { resizeImageForUpload } from "@/lib/client-image-resize";
import { cn } from "@/lib/utils";

export function VehiclePhotosSection({ vehicleId, vehicleLabel, photos }: { vehicleId: string; vehicleLabel: string; photos: VehiclePhotoDTO[] }) {
  const [isDropzoneActive, setIsDropzoneActive] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Local, reorderable copy of the server order — updated optimistically on
  // drop, and re-synced whenever the server list changes underneath it (a
  // new upload, a delete, or another tab's reorder landing via revalidate).
  // Adjusted during render rather than an effect, per React's guidance for
  // resetting state when a prop changes — avoids an extra render pass.
  const [order, setOrder] = useState(photos);
  const [syncedPhotos, setSyncedPhotos] = useState(photos);
  if (photos !== syncedPhotos) {
    setSyncedPhotos(photos);
    setOrder(photos);
  }

  const dragFromIndex = useRef<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [, startReorder] = useTransition();

  function handleDragHandleStart(index: number) {
    dragFromIndex.current = index;
    setDraggingId(order[index].id);
  }
  function handleCardDragOver(index: number, e: DragEvent) {
    if (dragFromIndex.current === null) return;
    e.preventDefault();
    if (index !== dragFromIndex.current) setDragOverIndex(index);
  }
  function handleCardDrop(index: number) {
    const from = dragFromIndex.current;
    resetDrag();
    if (from === null || from === index) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(index, 0, moved);
    setOrder(next);
    startReorder(() => reorderVehiclePhotos(vehicleId, next.map((p) => p.id)));
  }
  function resetDrag() {
    dragFromIndex.current = null;
    setDraggingId(null);
    setDragOverIndex(null);
  }

  function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        // Phone camera photos routinely run well past Vercel's hard 4.5MB
        // serverless request-body ceiling — shrink before sending rather
        // than finding out with a 413 (see lib/client-image-resize.ts).
        const resized = await Promise.all(list.map((file) => resizeImageForUpload(file)));
        const fd = new FormData();
        for (const file of resized) fd.append("file", file);
        const result = await uploadVehiclePhotos(vehicleId, fd);
        if (!result.ok) setError(result.error ?? "Upload failed — try again.");
      } catch {
        // A request the server never got to handle (e.g. still rejected
        // as too large somewhere upstream) throws instead of returning
        // {ok:false} — surface it the same way rather than letting it
        // crash the page.
        setError("Upload failed — the file may be too large. Try a smaller photo.");
      }
    });
  }

  return (
    <Card className="mt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-[13.5px] font-semibold text-[var(--color-text)]">Photos · {photos.length}</div>
        <VehicleEditAllButton photoIds={photos.map((p) => p.id)} />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDropzoneActive(true);
        }}
        onDragLeave={() => setIsDropzoneActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDropzoneActive(false);
          upload(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[var(--radius-panel)] border border-dashed px-4 py-6 text-center transition-colors",
          isDropzoneActive ? "border-[var(--color-primary)] bg-[var(--color-info-bg)]" : "border-[var(--color-hairline)] hover:bg-[var(--color-fill-subtle)]",
        )}
      >
        {isPending ? (
          <div className="[animation:upload-pulse-tone_1.1s_ease-in-out_infinite] text-[12.5px] font-semibold text-[var(--color-info-text)]">
            <UploadingLabel label="Uploading…" />
          </div>
        ) : (
          <>
            <ImagePlus size={20} className="text-[var(--color-text-muted)]" />
            <div className="text-[12.5px] font-semibold text-[var(--color-text)]">Upload photos</div>
            <div className="text-[11px] text-[var(--color-text-muted)]">Drag &amp; drop, or click to choose files</div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="mt-1.5 text-[12px] text-[var(--color-negative-text)]">{error}</p>}

      {order.length > 0 && (
        <>
          <p className="mt-4 text-[11px] text-[var(--color-text-muted)]">
            Drag the grip on a photo to reorder — the first one is the cover shown on the inventory list.
          </p>
          <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {order.map((photo, index) => (
              <VehiclePhotoCard
                key={photo.id}
                photo={photo}
                alt={vehicleLabel}
                isCover={index === 0}
                isDragging={draggingId === photo.id}
                isDropTarget={dragOverIndex === index}
                onDragHandleStart={() => handleDragHandleStart(index)}
                onDragOver={(e) => handleCardDragOver(index, e)}
                onDrop={() => handleCardDrop(index)}
                onDragEnd={resetDrag}
              />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
