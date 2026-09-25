"use client";

import { useState, useTransition } from "react";
import { Wand2 } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UploadingLabel } from "@/components/uploading-indicator";
import { VehiclePhotoEditFields } from "@/components/vehicle-photo-edit-fields";
import { editVehiclePhotoAction } from "@/app/inventory/photo-actions";
import { DEFAULT_EDIT_SETTINGS } from "@/lib/vehicle-photo-settings";
import type { VehiclePhotoEditSettings, vehiclePhotoStatus } from "@/schema-sketch/schema";
import { cn } from "@/lib/utils";

export type VehiclePhotoStatus = (typeof vehiclePhotoStatus)[number];

// The magic-wand trigger + settings panel for one photo. Opening it seeds
// the form from whatever settings produced the photo's current edit (or
// the defaults, for a first-ever edit) — so Regenerate starts from "what
// I already asked for" and the operator only has to touch the one slider
// or toggle they want to change, e.g. turning Cinematic Grade down a
// notch when the last pass distorted something.
export function VehiclePhotoEditPanel({
  photoId,
  status,
  editSettings,
  editError,
}: {
  photoId: string;
  status: VehiclePhotoStatus;
  editSettings: VehiclePhotoEditSettings | null;
  editError: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<VehiclePhotoEditSettings>(editSettings ?? DEFAULT_EDIT_SETTINGS);
  const [error, setError] = useState<string | null>(editError);
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof VehiclePhotoEditSettings>(key: K, value: VehiclePhotoEditSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await editVehiclePhotoAction(photoId, settings);
      if (!result.ok) {
        setError(result.error ?? "Editing failed — try again.");
        return;
      }
      setOpen(false);
    });
  }

  const hasResult = status === "edited" || status === "failed";
  const pending = isPending || status === "processing";

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
      <DialogTrigger asChild>
        <button
          type="button"
          title={pending ? "Editing…" : hasResult ? "Regenerate with AI" : "Edit with AI"}
          className={cn(
            "relative flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-card)] transition-transform after:absolute after:-inset-1 after:content-[''] active:scale-90",
            pending && "[animation:upload-pulse-tone_1.1s_ease-in-out_infinite]",
          )}
        >
          <Wand2 size={15} className={pending ? "[animation:upload-arrow-bounce_0.9s_ease-in-out_infinite]" : undefined} />
        </button>
      </DialogTrigger>
      <DialogContent title={hasResult ? "Regenerate photo" : "Edit photo with AI"} subtitle="Professional dealership listing look" className="max-w-md">
        <VehiclePhotoEditFields settings={settings} onChange={set} />

        {error && <p className="mt-3 text-[12px] text-[var(--color-negative-text)]">{error}</p>}

        <Button
          type="button"
          onClick={generate}
          disabled={pending}
          className={cn("mt-4 w-full", pending && "[animation:upload-pulse-tone_1.1s_ease-in-out_infinite]")}
        >
          {pending ? <UploadingLabel label="Generating…" /> : hasResult ? "Regenerate" : "Generate"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
