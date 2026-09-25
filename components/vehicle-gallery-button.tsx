"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Images } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface GalleryPhoto {
  id: string;
  url: string;
}

// Quick read-only look at every photo for a vehicle, right from the
// inventory grid — no need to open the full detail page just to see what
// a unit looks like. Editing/uploading still only happens on the detail
// page (components/vehicle-photos-section.tsx); this is view-only.
export function VehicleGalleryButton({ photos, label }: { photos: GalleryPhoto[]; label: string }) {
  const [index, setIndex] = useState(0);

  if (photos.length === 0) return null;

  return (
    <Dialog onOpenChange={(open) => open && setIndex(0)}>
      <DialogTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          title={`View all ${photos.length} photo${photos.length === 1 ? "" : "s"}`}
          className="relative z-10 flex items-center gap-1 rounded-[var(--radius-pill)] bg-black/60 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm transition-transform active:scale-95"
        >
          <Images size={13} /> {photos.length}
        </button>
      </DialogTrigger>
      <DialogContent title={label} subtitle={`${photos.length} photo${photos.length === 1 ? "" : "s"}`} className="max-w-2xl">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[index].url}
            alt={`${label} — photo ${index + 1} of ${photos.length}`}
            className="max-h-[70vh] w-full rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] object-contain"
          />
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setIndex((i) => (i - 1 + photos.length) % photos.length)}
                title="Previous photo"
                className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--color-text)] shadow-[var(--shadow-card)] active:scale-90"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => setIndex((i) => (i + 1) % photos.length)}
                title="Next photo"
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--color-text)] shadow-[var(--shadow-card)] active:scale-90"
              >
                <ChevronRight size={16} />
              </button>
            </>
          )}
        </div>
        {photos.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {photos.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.id}
                src={p.url}
                alt=""
                onClick={() => setIndex(i)}
                className={cn(
                  "h-14 w-14 flex-none cursor-pointer rounded-[var(--radius-panel)] object-cover",
                  i === index ? "ring-2 ring-[var(--color-primary)]" : "opacity-70 hover:opacity-100",
                )}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
