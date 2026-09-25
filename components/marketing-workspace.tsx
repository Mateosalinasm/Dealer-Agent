"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/utils";
import { daysSince } from "@/lib/deal-stage";
import { MarketingDetailPanel } from "@/components/marketing-detail-panel";

export interface MarketingVehicle {
  id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  color: string | null;
  stockNumber: string | null;
  askingPrice: number | null;
  miles: number | null;
  title: string;
  bodyType: "truck" | "sedan" | "suv" | null;
  fuelType: "gas" | "diesel" | "hybrid" | "electric";
  isThreeRowSuv: boolean;
  sold: boolean;
  marketingStatus: "not_marketed" | "ready_to_post" | "posted" | "needs_new_post" | "lead_generated";
  acquiredOn: string | null;
}

export interface MarketingPostRow {
  vehicleId: string;
  platform: "facebook_marketplace" | "facebook_post" | "instagram_caption" | "tiktok_caption";
  language: "es" | "en";
  body: string | null;
  postedAt: string | null;
  postedVia: "manual" | "auto" | null;
  externalListingUrl: string | null;
  queuedForAutoPost: boolean;
  autoPostError: string | null;
}

export const STATUS_LABELS: Record<MarketingVehicle["marketingStatus"] | "sold", string> = {
  not_marketed: "Not marketed",
  ready_to_post: "Ready to post",
  posted: "Posted",
  needs_new_post: "Needs new post",
  lead_generated: "Lead generated",
  sold: "Sold",
};

const STATUS_TONE: Record<keyof typeof STATUS_LABELS, "neutral" | "positive" | "info" | "caution"> = {
  not_marketed: "neutral",
  ready_to_post: "info",
  posted: "positive",
  needs_new_post: "caution",
  lead_generated: "positive",
  sold: "neutral",
};

export function displayStatus(v: MarketingVehicle): keyof typeof STATUS_LABELS {
  return v.sold ? "sold" : v.marketingStatus;
}

function vehicleTitle(v: MarketingVehicle) {
  return [v.year, v.make, v.model].filter(Boolean).join(" ") || "Unnamed vehicle";
}

export function MarketingWorkspace({ vehicles, posts }: { vehicles: MarketingVehicle[]; posts: MarketingPostRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(vehicles[0]?.id ?? null);
  const selected = vehicles.find((v) => v.id === selectedId) ?? vehicles[0] ?? null;

  const postsByVehicle = useMemo(() => {
    const map = new Map<string, MarketingPostRow[]>();
    for (const p of posts) {
      const list = map.get(p.vehicleId) ?? [];
      list.push(p);
      map.set(p.vehicleId, list);
    }
    return map;
  }, [posts]);

  if (vehicles.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] bg-[var(--color-surface)] p-8 text-center">
        <div className="text-[15px] font-semibold text-[var(--color-text)]">No vehicles in inventory yet</div>
        <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">Add one on the Inventory page and it shows up here automatically.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
      <div className="flex flex-col gap-2">
        {vehicles.map((v) => {
          const days = v.acquiredOn ? daysSince(new Date(v.acquiredOn + "T00:00:00")) : null;
          const vehiclePosts = postsByVehicle.get(v.id) ?? [];
          const postedCount = vehiclePosts.filter((p) => p.postedAt).length;
          const status = displayStatus(v);
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelectedId(v.id)}
              className={`rounded-[var(--radius-card)] bg-[var(--color-surface)] p-4 text-left shadow-[var(--shadow-card)] transition-colors ${
                selected?.id === v.id ? "ring-2 ring-[var(--color-primary)]" : "hover:bg-[var(--color-fill-subtle)]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 text-[14px] font-semibold text-[var(--color-text)]">{vehicleTitle(v)}</div>
                <Badge tone={STATUS_TONE[status]} className="flex-none">
                  {STATUS_LABELS[status]}
                </Badge>
              </div>
              <div className="mt-1 truncate text-[11.5px] text-[var(--color-text-muted)]">
                {v.stockNumber ? `Stock ${v.stockNumber} · ` : ""}
                {v.askingPrice != null ? formatCents(v.askingPrice) : "No price"}
                {days != null ? ` · ${days}d on lot` : ""}
              </div>
              <div className="mt-0.5 text-[11px] text-[var(--color-text-placeholder)]">
                {postedCount} post{postedCount === 1 ? "" : "s"}
              </div>
            </button>
          );
        })}
      </div>

      {selected && <MarketingDetailPanel key={selected.id} vehicle={selected} posts={postsByVehicle.get(selected.id) ?? []} />}
    </div>
  );
}
