"use client";

import { useRef, useState, useTransition } from "react";
import type { DragEvent } from "react";
import { Download, ImagePlus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadingLabel } from "@/components/uploading-indicator";
import { VehiclePhotoCard, type VehiclePhotoDTO } from "@/components/vehicle-photo-card";
import { VehicleEditAllButton } from "@/components/vehicle-edit-all-button";
import { uploadVehiclePhotos, reorderVehiclePhotos, deleteVehiclePhoto } from "@/app/inventory/photo-actions";
import { resizeImageForUpload } from "@/lib/client-image-resize";
import { downloadPhotosAsZip } from "@/lib/download-zip";
import { MAX_VEHICLE_PHOTOS } from "@/lib/vehicle-photo-settings";
import { cn } from "@/lib/utils";

export function VehiclePhotosSection({ vehicleId, vehicleLabel, photos }: { vehicleId: string; vehicleLabel: string; photos: VehiclePhotoDTO[] }) {
  const [isCardDragActive, setIsCardDragActive] = useState(false);
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

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isZipping, startZip] = useTransition();
  const [isDeletingSelected, startDeleteSelected] = useTransition();

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

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelected(new Set());
  }
  function toggleSelectOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    setSelected((prev) => (prev.size === order.length ? new Set() : new Set(order.map((p) => p.id))));
  }

  function upload(files: FileList | File[]) {
    let list = Array.from(files);
    if (list.length === 0) return;
    setError(null);

    const room = MAX_VEHICLE_PHOTOS - order.length;
    if (room <= 0) {
      setError(`This vehicle already has the maximum of ${MAX_VEHICLE_PHOTOS} photos — delete one before adding more.`);
      return;
    }
    if (list.length > room) {
      setError(`Only added ${room} — this vehicle is capped at ${MAX_VEHICLE_PHOTOS} photos.`);
      list = list.slice(0, room);
    }

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
        else if (result.error) setError(result.error); // ok:true partial-cap notice
      } catch {
        // A request the server never got to handle (e.g. still rejected
        // as too large somewhere upstream) throws instead of returning
        // {ok:false} — surface it the same way rather than letting it
        // crash the page.
        setError("Upload failed — the file may be too large. Try a smaller photo.");
      }
    });
  }

  function downloadAll() {
    startZip(() =>
      downloadPhotosAsZip(
        order.map((p) => ({ url: p.editedUrl ?? p.originalUrl, mimeType: p.mimeType })),
        `${vehicleLabel || "vehicle"}-photos.zip`,
      ),
    );
  }
  function downloadSelected() {
    const chosen = order.filter((p) => selected.has(p.id));
    startZip(() =>
      downloadPhotosAsZip(
        chosen.map((p) => ({ url: p.editedUrl ?? p.originalUrl, mimeType: p.mimeType })),
        `${vehicleLabel || "vehicle"}-photos-selected.zip`,
      ),
    );
  }

  function deleteSelected() {
    const ids = [...selected];
    startDeleteSelected(async () => {
      await Promise.all(ids.map((id) => deleteVehiclePhoto(id)));
      setSelectMode(false);
      setSelected(new Set());
    });
  }

  const atCap = order.length >= MAX_VEHICLE_PHOTOS;

  return (
    <Card
      className="mt-4"
      onDragOver={(e) => {
        if (selectMode) return;
        e.preventDefault();
        setIsCardDragActive(true);
      }}
      onDragLeave={() => setIsCardDragActive(false)}
      onDrop={(e) => {
        if (selectMode) return;
        e.preventDefault();
        setIsCardDragActive(false);
        upload(e.dataTransfer.files);
      }}
    >
      <div className={cn("mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-panel)] transition-colors", isCardDragActive && "bg-[var(--color-info-bg)]")}>
        <div className="text-[13.5px] font-semibold text-[var(--color-text)]">Photos · {photos.length}</div>
        {!selectMode && (
          <div className="flex flex-wrap items-center gap-1.5">
            {photos.length > 0 && (
              <Button type="button" variant="secondary" disabled={isZipping} onClick={downloadAll} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px]">
                <Download size={13} /> {isZipping ? "Zipping…" : "Download all"}
              </Button>
            )}
            {photos.length >= 2 && <VehicleEditAllButton photoIds={photos.map((p) => p.id)} />}
            <Button
              type="button"
              variant="secondary"
              disabled={isPending || atCap}
              title={atCap ? `Capped at ${MAX_VEHICLE_PHOTOS} photos` : undefined}
              onClick={() => inputRef.current?.click()}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 text-[12px]", isPending && "[animation:upload-pulse-tone_1.1s_ease-in-out_infinite]")}
            >
              {isPending ? <UploadingLabel label="Uploading…" /> : (
                <>
                  <ImagePlus size={13} /> Upload photos
                </>
              )}
            </Button>
            {photos.length > 1 && (
              <Button type="button" variant="ghost" onClick={toggleSelectMode} className="px-3 py-1.5 text-[12px]">
                Select
              </Button>
            )}
          </div>
        )}
      </div>

      {selectMode && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] px-3 py-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-[12px] font-medium text-[var(--color-text)]">
            <input
              type="checkbox"
              checked={order.length > 0 && selected.size === order.length}
              onChange={toggleSelectAll}
              className="h-3.5 w-3.5 rounded accent-[var(--color-primary)]"
            />
            Select all {order.length > 0 ? `(${order.length})` : ""}
          </label>
          <span className="text-[12px] text-[var(--color-text-muted)]">{selected.size} selected</span>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Button type="button" variant="secondary" disabled={selected.size === 0 || isZipping} onClick={downloadSelected} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px]">
              <Download size={13} /> {isZipping ? "Zipping…" : `Download ${selected.size || ""}`}
            </Button>
            {selected.size > 0 && (
              <VehicleEditAllButton
                photoIds={[...selected]}
                triggerLabel={`Edit selected (${selected.size})`}
                dialogTitle="Edit selected photos"
                dialogSubtitle={`Applies to the ${selected.size} photo${selected.size === 1 ? "" : "s"} you selected`}
                onDone={() => {
                  setSelectMode(false);
                  setSelected(new Set());
                }}
              />
            )}
            <Button
              type="button"
              variant="destructive"
              disabled={selected.size === 0 || isDeletingSelected}
              onClick={deleteSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px]"
            >
              <Trash2 size={13} /> {isDeletingSelected ? "Deleting…" : `Delete ${selected.size || ""}`}
            </Button>
            <Button type="button" variant="ghost" onClick={toggleSelectMode} className="px-3 py-1.5 text-[12px]">
              Cancel
            </Button>
          </div>
        </div>
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
      {error && <p className="mb-1 text-[12px] text-[var(--color-negative-text)]">{error}</p>}

      {order.length > 0 ? (
        <>
          <p className="mb-2 text-[11px] text-[var(--color-text-muted)]">
            Drag the grip on a photo to reorder — the first one is the cover shown on the inventory list. Drag &amp; drop new photos anywhere on this card, or use Upload photos above.
          </p>
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                selectMode={selectMode}
                selected={selected.has(photo.id)}
                onToggleSelect={() => toggleSelectOne(photo.id)}
              />
            ))}
          </div>
        </>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[var(--radius-panel)] border border-dashed border-[var(--color-hairline)] px-4 py-6 text-center hover:bg-[var(--color-fill-subtle)]"
        >
          <ImagePlus size={20} className="text-[var(--color-text-muted)]" />
          <div className="text-[12.5px] font-semibold text-[var(--color-text)]">No photos yet</div>
          <div className="text-[11px] text-[var(--color-text-muted)]">Drag &amp; drop, or click to choose files</div>
        </div>
      )}
    </Card>
  );
}
