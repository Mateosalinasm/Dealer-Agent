"use client";

import { useState, useTransition } from "react";
import type { DragEvent } from "react";
import { Download, GripVertical, Loader2, MoreVertical, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { BeforeAfterSlider } from "@/components/before-after-slider";
import { VehiclePhotoEditPanel, type VehiclePhotoStatus } from "@/components/vehicle-photo-edit-panel";
import { deleteVehiclePhoto, revertVehiclePhoto } from "@/app/inventory/photo-actions";
import type { VehiclePhotoEditSettings } from "@/schema-sketch/schema";
import { cn } from "@/lib/utils";

export interface VehiclePhotoDTO {
  id: string;
  originalUrl: string;
  editedUrl: string | null;
  status: VehiclePhotoStatus;
  editSettings: VehiclePhotoEditSettings | null;
  editError: string | null;
  mimeType: string | null;
}

export function VehiclePhotoCard({
  photo,
  alt,
  isCover,
  isDragging,
  isDropTarget,
  onDragHandleStart,
  onDragOver,
  onDrop,
  onDragEnd,
  selectMode,
  selected,
  onToggleSelect,
}: {
  photo: VehiclePhotoDTO;
  alt: string;
  isCover?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  onDragHandleStart?: () => void;
  onDragOver?: (e: DragEvent) => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const [isDeleting, startDelete] = useTransition();
  const [isReverting, startRevert] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);

  function onDelete() {
    startDelete(() => deleteVehiclePhoto(photo.id));
  }
  function onRevert() {
    startRevert(() => revertVehiclePhoto(photo.id));
  }

  return (
    <div
      onDragOver={selectMode ? undefined : onDragOver}
      onDrop={
        selectMode
          ? undefined
          : (e) => {
              e.preventDefault();
              onDrop?.();
            }
      }
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] transition-opacity",
        isDeleting && "opacity-40",
        isDragging && "opacity-40",
        isDropTarget && "ring-2 ring-[var(--color-primary)]",
        selected && "ring-2 ring-[var(--color-primary)]",
      )}
    >
      {photo.editedUrl ? (
        <BeforeAfterSlider beforeSrc={photo.originalUrl} afterSrc={photo.editedUrl} alt={alt} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.originalUrl} alt={alt} className="aspect-[3/4] w-full object-cover" draggable={false} />
      )}

      {selectMode && (
        <button
          type="button"
          onClick={onToggleSelect}
          aria-label={selected ? "Deselect photo" : "Select photo"}
          className="absolute inset-0 z-10"
        />
      )}

      {photo.status === "processing" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/35">
          <Loader2 size={22} className="animate-spin text-white" />
        </div>
      )}

      <div className="absolute left-2 top-2 z-20 flex items-center gap-1.5">
        {selectMode ? (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded accent-[var(--color-primary)]"
          />
        ) : (
          <div
            draggable
            onDragStart={onDragHandleStart}
            onDragEnd={onDragEnd}
            title="Drag to reorder"
            className="relative flex h-8 w-8 flex-none cursor-grab items-center justify-center rounded-full bg-[var(--color-surface)] text-[var(--color-text-muted)] shadow-[var(--shadow-card)] active:cursor-grabbing"
          >
            <GripVertical size={14} />
          </div>
        )}
        {isCover && (
          <span className="rounded-[var(--radius-pill)] bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-[.04em] text-white">
            Cover
          </span>
        )}
      </div>

      {!selectMode && (
        <div className="absolute right-2 top-2 z-20">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            title="Photo actions"
            className="relative flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-card)] transition-transform after:absolute after:-inset-1 after:content-[''] active:scale-90"
          >
            <MoreVertical size={15} />
          </button>

          {menuOpen && (
            <>
              {/* Closes the menu on any outside click — sits behind the panel below. */}
              <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-30 cursor-default" />
              <div
                onClick={() => setMenuOpen(false)}
                className="absolute right-0 top-9 z-40 w-48 rounded-[var(--radius-panel)] border border-[var(--color-hairline)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-card)]"
              >
                <VehiclePhotoEditPanel
                  photoId={photo.id}
                  status={photo.status}
                  editSettings={photo.editSettings}
                  editError={photo.editError}
                  asMenuItem
                />
                {photo.editedUrl && (
                  <button
                    type="button"
                    onClick={onRevert}
                    disabled={isReverting}
                    className="flex w-full items-center gap-2 rounded-[var(--radius-panel)] px-2.5 py-2 text-left text-[12.5px] text-[var(--color-text)] hover:bg-[var(--color-fill-subtle)] disabled:opacity-50"
                  >
                    <RotateCcw size={14} /> Revert to original
                  </button>
                )}
                <a
                  href={photo.editedUrl ?? photo.originalUrl}
                  download
                  className="flex w-full items-center gap-2 rounded-[var(--radius-panel)] px-2.5 py-2 text-left text-[12.5px] text-[var(--color-text)] hover:bg-[var(--color-fill-subtle)]"
                >
                  <Download size={14} /> Download
                </a>
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={isDeleting}
                  className="flex w-full items-center gap-2 rounded-[var(--radius-panel)] px-2.5 py-2 text-left text-[12.5px] text-[var(--color-negative-text)] hover:bg-[var(--color-negative-bg)] disabled:opacity-50"
                >
                  <Trash2 size={14} /> Delete photo
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {photo.status === "failed" && photo.editError && (
        <div className="absolute inset-x-0 bottom-0 flex items-start gap-1.5 bg-[var(--color-negative-bg)] px-2.5 py-1.5 text-[11px] text-[var(--color-negative-text)]">
          <TriangleAlert size={13} className="mt-px flex-none" />
          <span className="line-clamp-2">{photo.editError}</span>
        </div>
      )}
    </div>
  );
}
