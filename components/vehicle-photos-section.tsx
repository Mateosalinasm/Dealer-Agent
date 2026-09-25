"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { UploadingLabel } from "@/components/uploading-indicator";
import { VehiclePhotoCard, type VehiclePhotoDTO } from "@/components/vehicle-photo-card";
import { uploadVehiclePhotos } from "@/app/inventory/photo-actions";
import { cn } from "@/lib/utils";

export function VehiclePhotosSection({ vehicleId, vehicleLabel, photos }: { vehicleId: string; vehicleLabel: string; photos: VehiclePhotoDTO[] }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      for (const file of list) fd.append("file", file);
      const result = await uploadVehiclePhotos(vehicleId, fd);
      if (!result.ok) setError(result.error ?? "Upload failed — try again.");
    });
  }

  return (
    <Card className="mt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-[13.5px] font-semibold text-[var(--color-text)]">Photos · {photos.length}</div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          upload(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[var(--radius-panel)] border border-dashed px-4 py-6 text-center transition-colors",
          isDragging ? "border-[var(--color-primary)] bg-[var(--color-info-bg)]" : "border-[var(--color-hairline)] hover:bg-[var(--color-fill-subtle)]",
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

      {photos.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <VehiclePhotoCard key={photo.id} photo={photo} alt={vehicleLabel} />
          ))}
        </div>
      )}
    </Card>
  );
}
