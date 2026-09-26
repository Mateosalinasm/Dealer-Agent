"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { IconCar, IconCarSuv } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { PickupTruckIcon } from "@/components/icons/pickup-truck-icon";
import { formatCents, cn } from "@/lib/utils";
import { daysSince } from "@/lib/deal-stage";
import { MarketingDetailPanel } from "@/components/marketing-detail-panel";

type BodyType = "truck" | "sedan" | "suv";

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
  bodyType: BodyType | null;
  fuelType: "gas" | "diesel" | "hybrid" | "electric";
  isThreeRowSuv: boolean;
  sold: boolean;
  marketingStatus: "not_marketed" | "ready_to_post" | "posted" | "needs_new_post" | "lead_generated";
  acquiredOn: string | null;
  coverUrl: string | null;
}

type Category = "all" | BodyType;
const CATEGORY_ICONS: Record<BodyType, React.ComponentType<{ size?: number; className?: string }>> = {
  sedan: IconCar,
  truck: PickupTruckIcon,
  suv: IconCarSuv,
};
const CATEGORY_LABELS: Record<BodyType, string> = { sedan: "Sedans", truck: "Trucks", suv: "SUVs" };

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
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("all");
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = vehicles;
    if (category !== "all") list = list.filter((v) => v.bodyType === category);
    if (q) list = list.filter((v) => [vehicleTitle(v), v.trim, v.stockNumber, v.color].filter(Boolean).some((f) => f!.toLowerCase().includes(q)));
    return list;
  }, [vehicles, query, category]);

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
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-placeholder)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search — year, make, model, stock #, color…"
              className="w-full rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-surface)] py-1.5 pl-8 pr-3 text-[12.5px] text-[var(--color-text)] placeholder:text-[var(--color-text-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            />
          </div>
          <div className="flex flex-none items-center gap-0.5 rounded-[var(--radius-pill)] bg-[var(--color-fill-subtle)] p-0.5">
            <button
              type="button"
              onClick={() => setCategory("all")}
              title="All body types"
              className={cn(
                "rounded-[var(--radius-pill)] px-2 py-1 text-[11px] font-semibold transition-colors",
                category === "all" ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-card)]" : "text-[var(--color-text-muted)]",
              )}
            >
              All
            </button>
            {(Object.keys(CATEGORY_ICONS) as BodyType[]).map((bt) => {
              const Icon = CATEGORY_ICONS[bt];
              return (
                <button
                  key={bt}
                  type="button"
                  onClick={() => setCategory((prev) => (prev === bt ? "all" : bt))}
                  title={CATEGORY_LABELS[bt]}
                  className={cn(
                    "flex h-7 items-center justify-center rounded-[var(--radius-pill)] px-1.5 transition-colors",
                    category === bt ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-card)]" : "text-[var(--color-text-muted)]",
                  )}
                >
                  <Icon size={18} />
                </button>
              );
            })}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="p-4 text-center text-[12.5px] text-[var(--color-text-muted)]">No vehicles match this search/filter.</p>
        ) : (
          filtered.map((v) => {
            const days = v.acquiredOn ? daysSince(new Date(v.acquiredOn + "T00:00:00")) : null;
            const vehiclePosts = postsByVehicle.get(v.id) ?? [];
            const postedCount = vehiclePosts.filter((p) => p.postedAt).length;
            const status = displayStatus(v);
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedId(v.id)}
                className={`flex items-start gap-3 rounded-[var(--radius-card)] bg-[var(--color-surface)] p-3 text-left shadow-[var(--shadow-card)] transition-colors ${
                  selected?.id === v.id ? "ring-2 ring-[var(--color-primary)]" : "hover:bg-[var(--color-fill-subtle)]"
                }`}
              >
                <div className="h-14 w-20 flex-none overflow-hidden rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)]">
                  {v.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[var(--color-text-placeholder)]">
                      {v.bodyType ? (() => { const Icon = CATEGORY_ICONS[v.bodyType]; return <Icon size={20} />; })() : null}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
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
                </div>
              </button>
            );
          })
        )}
      </div>

      {selected && <MarketingDetailPanel key={selected.id} vehicle={selected} posts={postsByVehicle.get(selected.id) ?? []} />}
    </div>
  );
}
