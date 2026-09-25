"use client";

import { useTransition } from "react";
import { Download, Loader2, Trash2, TriangleAlert } from "lucide-react";
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

export function VehiclePhotoCard({ photo, alt }: { photo: VehiclePhotoDTO; alt: string }) {
  const [isDeleting, startDelete] = useTransition();

  function onDelete() {
    startDelete(() => deleteVehiclePhoto(photo.id));
  }

  return (
    <div className={cn("relative overflow-hidden rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)]", isDeleting && "opacity-40")}>
      {photo.editedUrl ? (
        <BeforeAfterSlider beforeSrc={photo.originalUrl} afterSrc={photo.editedUrl} alt={alt} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.originalUrl} alt={alt} className="aspect-[4/3] w-full object-cover" />
      )}

      {photo.status === "processing" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/35">
          <Loader2 size={22} className="animate-spin text-white" />
        </div>
      )}

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
