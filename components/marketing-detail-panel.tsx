"use client";

import { useMemo, useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { formatCents, cn } from "@/lib/utils";
import {
  generateListing,
  logLeadFromVehicle,
  markPosted,
  queueForAutoPost,
  setMarketingStatus,
  unqueueAutoPost,
  updateListingBody,
  updateVehicleMarketingFacts,
} from "@/app/marketing/actions";
import { STATUS_LABELS, displayStatus, type MarketingPostRow, type MarketingVehicle } from "@/components/marketing-workspace";

const PLATFORMS = [
  { value: "facebook_marketplace", label: "Facebook Marketplace" },
  { value: "facebook_post", label: "Facebook post" },
  { value: "instagram_caption", label: "Instagram caption" },
  { value: "tiktok_caption", label: "TikTok caption" },
] as const;

const LANGUAGES = [
  { value: "es", label: "Spanish" },
  { value: "en", label: "English" },
] as const;

const STATUS_PILLS: MarketingVehicle["marketingStatus"][] = ["not_marketed", "ready_to_post", "posted", "needs_new_post", "lead_generated"];

function vehicleTitle(v: MarketingVehicle) {
  return [v.year, v.make, v.model].filter(Boolean).join(" ") || "Unnamed vehicle";
}

export function MarketingDetailPanel({ vehicle, posts }: { vehicle: MarketingVehicle; posts: MarketingPostRow[] }) {
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]["value"]>("facebook_marketplace");
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]["value"]>("es");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [isGenerating, startGenerate] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loggingLead, setLoggingLead] = useState(false);
  const [editingFacts, setEditingFacts] = useState(false);

  const key = `${platform}:${language}`;
  const savedPost = posts.find((p) => p.platform === platform && p.language === language);
  const body = drafts[key] ?? savedPost?.body ?? "";

  const status = displayStatus(vehicle);
  const canGenerate = !!vehicle.bodyType;

  const postHistory = useMemo(
    () =>
      posts
        .filter((p) => p.postedAt)
        .sort((a, b) => new Date(b.postedAt!).getTime() - new Date(a.postedAt!).getTime()),
    [posts],
  );

  function handleGenerate() {
    setError(null);
    startGenerate(async () => {
      const result = await generateListing(vehicle.id, platform, language);
      if (result.ok && result.text) {
        setDrafts((prev) => ({ ...prev, [key]: result.text! }));
      } else {
        setError(result.error ?? "Couldn't generate a listing.");
      }
    });
  }

  function handleBodyChange(next: string) {
    setDrafts((prev) => ({ ...prev, [key]: next }));
  }

  function handleSave() {
    startSave(() => updateListingBody(vehicle.id, platform, language, body));
  }

  function handleCopy() {
    if (!body) return;
    navigator.clipboard.writeText(body).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleMarkPosted() {
    startSave(() => markPosted(vehicle.id, platform, language));
  }

  function handleQueueAutoPost() {
    setError(null);
    startSave(async () => {
      const result = await queueForAutoPost(vehicle.id, platform, language);
      if (!result.ok) setError(result.error ?? "Couldn't queue this listing.");
    });
  }

  function handleUnqueueAutoPost() {
    startSave(() => unqueueAutoPost(vehicle.id, platform, language));
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <div className="text-[17px] font-semibold text-[var(--color-text)]">{vehicleTitle(vehicle)}</div>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Fact label="Price" value={vehicle.askingPrice != null ? formatCents(vehicle.askingPrice) : "—"} />
          <Fact label="Mileage" value={vehicle.miles != null ? vehicle.miles.toLocaleString() : "—"} />
          <Fact label="Title" value={vehicle.title} />
          <Fact label="Trim" value={vehicle.trim || "Not entered"} />
          <Fact label="Stock" value={vehicle.stockNumber || "—"} />
        </div>
      </div>

      {!canGenerate && !editingFacts && (
        <div className="rounded-[var(--radius-panel)] bg-[var(--color-caution-bg)] p-3 text-[12.5px] text-[var(--color-caution-text)]">
          Set this vehicle&rsquo;s body type before generating a listing — the down payment depends on it.{" "}
          <button type="button" className="font-semibold underline" onClick={() => setEditingFacts(true)}>
            Set it now
          </button>
        </div>
      )}

      {editingFacts && (
        <VehicleFactsEditor
          vehicle={vehicle}
          onDone={() => setEditingFacts(false)}
        />
      )}

      {canGenerate && !editingFacts && (
        <button type="button" className="self-start text-[11px] font-semibold text-[var(--color-primary)] hover:underline" onClick={() => setEditingFacts(true)}>
          Edit body/fuel type
        </button>
      )}

      <div className="flex flex-wrap gap-1.5">
        {PLATFORMS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPlatform(p.value)}
            className={cn(
              "rounded-[var(--radius-pill)] px-3 py-1.5 text-[12.5px] font-medium",
              platform === p.value ? "bg-[var(--color-text)] text-[var(--color-surface)]" : "bg-[var(--color-fill-subtle)] text-[var(--color-text-muted)] hover:bg-[var(--color-hairline)]",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5">
        {LANGUAGES.map((l) => (
          <button
            key={l.value}
            type="button"
            onClick={() => setLanguage(l.value)}
            className={cn(
              "rounded-[var(--radius-pill)] px-3 py-1.5 text-[12.5px] font-medium",
              language === l.value ? "bg-[var(--color-text)] text-[var(--color-surface)]" : "bg-[var(--color-fill-subtle)] text-[var(--color-text-muted)] hover:bg-[var(--color-hairline)]",
            )}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={handleGenerate} disabled={!canGenerate || isGenerating}>
          {isGenerating ? "Writing…" : "Write the listing"}
        </Button>
        <Button type="button" variant="secondary" onClick={handleCopy} disabled={!body}>
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button type="button" variant="secondary" onClick={handleMarkPosted} disabled={!body || isSaving}>
          Mark posted
        </Button>
        {platform === "facebook_marketplace" &&
          !savedPost?.postedAt &&
          (savedPost?.queuedForAutoPost ? (
            <Button type="button" variant="secondary" onClick={handleUnqueueAutoPost} disabled={isSaving}>
              Cancel auto-post
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={handleQueueAutoPost} disabled={!body || isSaving}>
              Queue for auto-post
            </Button>
          ))}
        <Button type="button" variant="secondary" onClick={() => setLoggingLead((v) => !v)}>
          Log a lead
        </Button>
      </div>

      {platform === "facebook_marketplace" && savedPost?.queuedForAutoPost && (
        <p className="rounded-[var(--radius-panel)] bg-[var(--color-info-bg)] p-2.5 text-[11.5px] text-[var(--color-info-text)]">
          Queued — the browser extension will post this automatically at its next scheduled time.
        </p>
      )}
      {platform === "facebook_marketplace" && savedPost?.autoPostError && (
        <p className="rounded-[var(--radius-panel)] bg-[var(--color-negative-bg)] p-2.5 text-[11.5px] text-[var(--color-negative-text)]">
          Last auto-post attempt failed: {savedPost.autoPostError}
        </p>
      )}
      {platform === "facebook_marketplace" && savedPost?.postedVia === "auto" && (
        <p className="rounded-[var(--radius-panel)] bg-[var(--color-positive-bg)] p-2.5 text-[11.5px] text-[var(--color-positive-text)]">
          Auto-posted by the extension.{" "}
          {savedPost.externalListingUrl && (
            <a href={savedPost.externalListingUrl} target="_blank" rel="noreferrer" className="font-semibold underline">
              View listing
            </a>
          )}
        </p>
      )}

      {error && <p className="text-[11.5px] text-[var(--color-negative-text)]">{error}</p>}

      <textarea
        value={body}
        onChange={(e) => handleBodyChange(e.target.value)}
        onBlur={handleSave}
        placeholder="The generated listing lands here — edit it before you post."
        rows={12}
        className="w-full resize-y rounded-[var(--radius-panel)] border border-[var(--color-hairline)] bg-[var(--color-surface)] p-3 text-[13.5px] leading-relaxed outline-none focus:border-[var(--color-primary)]"
      />

      <p className="text-[11px] text-[var(--color-text-muted)]">
        Only facts from the vehicle record are used — no invented features. Nothing is sent to any platform from this
        page directly; Facebook Marketplace posting only happens through the paired browser extension, and only for
        listings you explicitly queue.
      </p>

      {loggingLead && (
        <form
          action={async (fd) => {
            await logLeadFromVehicle(vehicle.id, fd);
            setLoggingLead(false);
          }}
          className="flex flex-wrap items-end gap-2 rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] p-3"
        >
          <div className="flex-1">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">Name</label>
            <input name="name" required className="w-full rounded-[var(--radius-panel)] border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-2 text-[13.5px] outline-none focus:border-[var(--color-primary)]" />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">Phone (optional)</label>
            <input name="phone" className="w-full rounded-[var(--radius-panel)] border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-2 text-[13.5px] outline-none focus:border-[var(--color-primary)]" />
          </div>
          <Button type="submit" variant="secondary">
            Save lead
          </Button>
        </form>
      )}

      <div className="border-t border-[var(--color-hairline)] pt-3">
        <div className="mb-2 text-[13px] font-semibold text-[var(--color-text)]">Marketing status</div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_PILLS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={vehicle.sold}
              onClick={() => startSave(() => setMarketingStatus(vehicle.id, s))}
              className={cn(
                "rounded-[var(--radius-pill)] px-3 py-1.5 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-50",
                status === s ? "bg-[var(--color-text)] text-[var(--color-surface)]" : "bg-[var(--color-fill-subtle)] text-[var(--color-text-muted)] hover:bg-[var(--color-hairline)]",
              )}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
          {vehicle.sold && (
            <span className="rounded-[var(--radius-pill)] bg-[var(--color-text)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-surface)]">Sold</span>
          )}
        </div>
      </div>

      <div>
        <div className="mb-1 text-[13px] font-semibold text-[var(--color-text)]">Post history</div>
        {postHistory.length === 0 ? (
          <p className="text-[12px] text-[var(--color-text-muted)]">Never posted.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {postHistory.map((p) => (
              <div key={`${p.platform}:${p.language}`} className="flex items-center justify-between text-[12px] text-[var(--color-text-muted)]">
                <span>
                  {PLATFORMS.find((pl) => pl.value === p.platform)?.label} · {LANGUAGES.find((l) => l.value === p.language)?.label}
                </span>
                <span className="tabular-nums">{new Date(p.postedAt!).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">{label}</div>
      <div className="text-[13px] font-semibold text-[var(--color-text)]">{value}</div>
    </div>
  );
}

function VehicleFactsEditor({ vehicle, onDone }: { vehicle: MarketingVehicle; onDone: () => void }) {
  const [bodyType, setBodyType] = useState(vehicle.bodyType ?? "");
  const [fuelType, setFuelType] = useState(vehicle.fuelType);
  const [isThreeRowSuv, setIsThreeRowSuv] = useState(vehicle.isThreeRowSuv);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] p-3">
      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">Body type</label>
        <Select value={bodyType} onChange={(e) => setBodyType(e.target.value as typeof bodyType)}>
          <option value="">—</option>
          <option value="truck">Truck</option>
          <option value="sedan">Sedan</option>
          <option value="suv">SUV</option>
        </Select>
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">Fuel</label>
        <Select value={fuelType} onChange={(e) => setFuelType(e.target.value as typeof fuelType)}>
          <option value="gas">Gas</option>
          <option value="diesel">Diesel</option>
          <option value="hybrid">Hybrid</option>
          <option value="electric">Electric</option>
        </Select>
      </div>
      {bodyType === "suv" && (
        <label className="flex cursor-pointer items-center gap-2 pb-2 text-[12.5px] text-[var(--color-text)]">
          <input type="checkbox" checked={isThreeRowSuv} onChange={(e) => setIsThreeRowSuv(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
          Big 3-row SUV
        </label>
      )}
      <Button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await updateVehicleMarketingFacts(vehicle.id, { bodyType: bodyType as "truck" | "sedan" | "suv" | "", fuelType, isThreeRowSuv });
            onDone();
          })
        }
      >
        Save
      </Button>
    </div>
  );
}
