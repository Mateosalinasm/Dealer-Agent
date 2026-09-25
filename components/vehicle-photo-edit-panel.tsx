"use client";

import { useState, useTransition } from "react";
import { Wand2 } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UploadingLabel } from "@/components/uploading-indicator";
import { editVehiclePhotoAction } from "@/app/inventory/photo-actions";
import { DEFAULT_EDIT_SETTINGS } from "@/lib/vehicle-photo-settings";
import type { VehiclePhotoEditSettings, vehiclePhotoStatus } from "@/schema-sketch/schema";
import { cn } from "@/lib/utils";

export type VehiclePhotoStatus = (typeof vehiclePhotoStatus)[number];

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5 text-[12.5px] text-[var(--color-text)]">
      {label}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 flex-none rounded accent-[var(--color-primary)]" />
    </label>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="py-1.5">
      <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
        <span>{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--color-primary)]"
      />
    </div>
  );
}

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
        <div className="flex flex-col divide-y divide-[var(--color-hairline)]">
          <div className="pb-2">
            <Toggle
              label="Preserve original background"
              checked={settings.preserveOriginalBackground}
              onChange={(v) => set("preserveOriginalBackground", v)}
            />
            <p className="mt-0.5 text-[10.5px] text-[var(--color-text-muted)]">
              {settings.preserveOriginalBackground ? "Only enhances the photo — keeps the original environment." : "Background: Automatic — empty grass lot"}
            </p>
          </div>

          {!settings.preserveOriginalBackground && (
            <div className="py-2">
              <Slider label="Background realism" value={settings.backgroundRealism} onChange={(v) => set("backgroundRealism", v)} />
            </div>
          )}

          <div className="py-2">
            <Toggle label="Enhance quality" checked={settings.enhanceQuality} onChange={(v) => set("enhanceQuality", v)} />
            {settings.enhanceQuality && <Slider label="Image quality" value={settings.imageQuality} onChange={(v) => set("imageQuality", v)} />}
          </div>

          <div className="py-2">
            <Toggle label="Remove license plate" checked={settings.removeLicensePlate} onChange={(v) => set("removeLicensePlate", v)} />
          </div>

          <div className="py-2">
            <Toggle label="Professional camera look" checked={settings.professionalCameraLook} onChange={(v) => set("professionalCameraLook", v)} />
          </div>

          <div className="pt-2">
            <Toggle label="Cinematic grade" checked={settings.cinematicGrade} onChange={(v) => set("cinematicGrade", v)} />
            {settings.cinematicGrade && <Slider label="Cinematic intensity" value={settings.cinematicIntensity} onChange={(v) => set("cinematicIntensity", v)} />}
          </div>
        </div>

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
