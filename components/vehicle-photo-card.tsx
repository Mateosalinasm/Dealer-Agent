"use client";

import { useTransition } from "react";
import type { DragEvent } from "react";
import { Download, GripVertical, Loader2, Trash2, TriangleAlert } from "lucide-react";
import { BeforeAfterSlider } from "@/components/before-after-slider";
import { VehiclePhotoEditPanel, type VehiclePhotoStatus } from "@/components/vehicle-photo-edit-panel";
import { deleteVehiclePhoto } from "@/app/inventory/photo-actions";
import type { VehiclePhotoEditSettings } from "@/schema-sketch/schema";
import { cn } from "@/lib/utils";

export interface VehiclePhotoDTO {
  id: string;
  originalUrl: string;
  editedUrl: string | null;
  status: VehiclePhotoStatus;
  editSettings: VehiclePhotoEditSettings | null;
  editError: string | null;
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
}) {
  const [isDeleting, startDelete] = useTransition();

  function onDelete() {
    startDelete(() => deleteVehiclePhoto(photo.id));
  }

  return (
    <div
      onDragOver={onDragOver}
      onDrop={(e) => {
        e.preventDefault();
        onDrop?.();
      }}
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] transition-opacity",
        isDeleting && "opacity-40",
        isDragging && "opacity-40",
        isDropTarget && "ring-2 ring-[var(--color-primary)]",
      )}
    >
      {photo.editedUrl ? (
        <BeforeAfterSlider beforeSrc={photo.originalUrl} afterSrc={photo.editedUrl} alt={alt} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.originalUrl} alt={alt} className="aspect-[4/3] w-full object-cover" draggable={false} />
      )}

      {photo.status === "processing" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/35">
          <Loader2 size={22} className="animate-spin text-white" />
        </div>
      )}

      <div className="absolute left-2 top-2 flex items-center gap-1.5">
        <div
          draggable
          onDragStart={onDragHandleStart}
          onDragEnd={onDragEnd}
          title="Drag to reorder"
          className="relative flex h-8 w-8 flex-none cursor-grab items-center justify-center rounded-full bg-[var(--color-surface)] text-[var(--color-text-muted)] shadow-[var(--shadow-card)] active:cursor-grabbing"
        >
          <GripVertical size={14} />
        </div>
        {isCover && (
          <span className="rounded-[var(--radius-pill)] bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-[.04em] text-white">
            Cover
          </span>
        )}
      </div>

      <div className="absolute right-2 top-2 flex items-center gap-1.5">
        <VehiclePhotoEditPanel photoId={photo.id} status={photo.status} editSettings={photo.editSettings} editError={photo.editError} />
        <a
          href={photo.editedUrl ?? photo.originalUrl}
          download
          title="Download"
          className="relative flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-card)] transition-transform after:absolute after:-inset-1 after:content-[''] active:scale-90"
        >
          <Download size={14} />
        </a>
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          title="Delete photo"
          className="relative flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--color-surface)] text-[var(--color-negative-text)] shadow-[var(--shadow-card)] transition-transform after:absolute after:-inset-1 after:content-[''] active:scale-90"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {photo.status === "failed" && photo.editError && (
        <div className="absolute inset-x-0 bottom-0 flex items-start gap-1.5 bg-[var(--color-negative-bg)] px-2.5 py-1.5 text-[11px] text-[var(--color-negative-text)]">
          <TriangleAlert size={13} className="mt-px flex-none" />
          <span className="line-clamp-2">{photo.editError}</span>
        </div>
      )}
    </div>
  );
}
