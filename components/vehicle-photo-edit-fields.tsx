"use client";

import { BACKGROUND_LABELS } from "@/lib/vehicle-photo-settings";
import type { VehiclePhotoEditSettings } from "@/schema-sketch/schema";
import { cn } from "@/lib/utils";

const BACKGROUND_OPTIONS = Object.entries(BACKGROUND_LABELS) as [keyof typeof BACKGROUND_LABELS, string][];

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
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--color-primary)]" />
    </div>
  );
}

// The full settings form — every toggle/slider/background choice the edit
// prompt (lib/photo-editor.ts) reads. Shared by the per-photo edit panel
// and the "Edit all" batch panel so the two stay in lockstep instead of
// drifting into two slightly-different copies of the same form.
export function VehiclePhotoEditFields({
  settings,
  onChange,
}: {
  settings: VehiclePhotoEditSettings;
  onChange: <K extends keyof VehiclePhotoEditSettings>(key: K, value: VehiclePhotoEditSettings[K]) => void;
}) {
  return (
    <div className="flex flex-col divide-y divide-[var(--color-hairline)]">
      <div className="pb-2">
        <Toggle label="Preserve original background" checked={settings.preserveOriginalBackground} onChange={(v) => onChange("preserveOriginalBackground", v)} />
        <p className="mt-0.5 text-[10.5px] text-[var(--color-text-muted)]">
          {settings.preserveOriginalBackground ? "Only enhances the photo — keeps the original environment." : "Replaces the background with the setting picked below."}
        </p>
      </div>

      {!settings.preserveOriginalBackground && (
        <div className="py-2">
          <div className="mb-1.5 text-[11px] text-[var(--color-text-muted)]">Background</div>
          <div className="grid grid-cols-2 gap-1.5">
            {BACKGROUND_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onChange("background", value)}
                className={cn(
                  "rounded-[var(--radius-panel)] border px-2.5 py-1.5 text-left text-[11.5px] font-medium transition-colors",
                  settings.background === value
                    ? "border-[var(--color-primary)] bg-[var(--color-info-bg)] text-[var(--color-info-text)]"
                    : "border-[var(--color-hairline)] text-[var(--color-text)] hover:bg-[var(--color-fill-subtle)]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-2">
            <Slider label="Background realism" value={settings.backgroundRealism} onChange={(v) => onChange("backgroundRealism", v)} />
          </div>
        </div>
      )}

      <div className="py-2">
        <Toggle label="Enhance quality" checked={settings.enhanceQuality} onChange={(v) => onChange("enhanceQuality", v)} />
        {settings.enhanceQuality && <Slider label="Image quality" value={settings.imageQuality} onChange={(v) => onChange("imageQuality", v)} />}
      </div>

      <div className="py-2">
        <Toggle label="Remove license plate" checked={settings.removeLicensePlate} onChange={(v) => onChange("removeLicensePlate", v)} />
      </div>

      <div className="py-2">
        <Toggle label="Turn on headlights/taillights" checked={settings.turnOnVehicleLights} onChange={(v) => onChange("turnOnVehicleLights", v)} />
        <p className="mt-0.5 text-[10.5px] text-[var(--color-text-muted)]">If they&rsquo;re off in the photo, lights them up so the vehicle pops more.</p>
      </div>

      <div className="py-2">
        <Toggle label="Professional camera look" checked={settings.professionalCameraLook} onChange={(v) => onChange("professionalCameraLook", v)} />
      </div>

      <div className="pt-2">
        <Toggle label="Cinematic grade" checked={settings.cinematicGrade} onChange={(v) => onChange("cinematicGrade", v)} />
        {settings.cinematicGrade && <Slider label="Cinematic intensity" value={settings.cinematicIntensity} onChange={(v) => onChange("cinematicIntensity", v)} />}
      </div>
    </div>
  );
}
