"use client";

import { useState, useTransition } from "react";
import { Wand2 } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UploadingLabel } from "@/components/uploading-indicator";
import { VehiclePhotoEditFields } from "@/components/vehicle-photo-edit-fields";
import { editVehiclePhotoAction } from "@/app/inventory/photo-actions";
import { DEFAULT_EDIT_SETTINGS } from "@/lib/vehicle-photo-settings";
import type { VehiclePhotoEditSettings } from "@/schema-sketch/schema";
import { cn } from "@/lib/utils";

// One settings pass applied to every photo on the vehicle in one click —
// picking a background/toggles/sliders once and running
// editVehiclePhotoAction for each photo id in parallel, instead of opening
// the per-photo panel N times for N uploads. Each photo still gets its own
// row/status/editSettings exactly as if it had been edited individually
// (see editVehiclePhotoAction), so a bad result on one photo can still be
// tuned and regenerated on its own afterward.
export function VehicleEditAllButton({ photoIds }: { photoIds: string[] }) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<VehiclePhotoEditSettings>(DEFAULT_EDIT_SETTINGS);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof VehiclePhotoEditSettings>(key: K, value: VehiclePhotoEditSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function generate() {
    setError(null);
    startTransition(async () => {
      const results = await Promise.all(photoIds.map((id) => editVehiclePhotoAction(id, settings)));
      const failed = results.filter((r) => !r.ok).length;
      if (failed > 0) {
        setError(`${failed} of ${photoIds.length} photo${photoIds.length === 1 ? "" : "s"} failed — check each one individually.`);
        return;
      }
      setOpen(false);
    });
  }

  if (photoIds.length < 2) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !isPending && setOpen(v)}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" disabled={isPending} className={cn("flex items-center gap-1.5 px-3 py-1.5 text-[12px]", isPending && "[animation:upload-pulse-tone_1.1s_ease-in-out_infinite]")}>
          {isPending ? (
            <UploadingLabel label={`Editing ${photoIds.length}…`} />
          ) : (
            <>
              <Wand2 size={13} /> Edit all {photoIds.length}
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent title="Edit all photos" subtitle={`Applies to all ${photoIds.length} photos on this vehicle`} className="max-w-md">
        <VehiclePhotoEditFields settings={settings} onChange={set} />

        {error && <p className="mt-3 text-[12px] text-[var(--color-negative-text)]">{error}</p>}

        <Button
          type="button"
          onClick={generate}
          disabled={isPending}
          className={cn("mt-4 w-full", isPending && "[animation:upload-pulse-tone_1.1s_ease-in-out_infinite]")}
        >
          {isPending ? <UploadingLabel label={`Generating ${photoIds.length}…`} /> : `Generate all ${photoIds.length}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
