"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Car, LayoutGrid, List as ListIcon, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VehicleGalleryButton, type GalleryPhoto } from "@/components/vehicle-gallery-button";
import { markVehicleSold } from "@/app/inventory/actions";
import { formatCents, cn } from "@/lib/utils";

export interface InventoryVehicleCard {
  id: string;
  label: string;
  stockNumber: string | null;
  vin: string | null;
  color: string | null;
  miles: number | null;
  daysAtLot: number | null;
  costCents: number;
  askingCents: number | null;
  sold: boolean;
  coverUrl: string | null;
  photos: GalleryPhoto[];
}

type ViewMode = "grid" | "list";

export function InventoryGrid({ vehicles }: { vehicles: InventoryVehicleCard[] }) {
  const [view, setView] = useState<ViewMode>("grid");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((v) => [v.label, v.stockNumber, v.vin, v.color].filter(Boolean).some((f) => f!.toLowerCase().includes(q)));
  }, [vehicles, query]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-placeholder)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search inventory — year, make, model, stock #, VIN, color…"
            className="w-full rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-surface)] py-1.5 pl-8 pr-3 text-[12.5px] text-[var(--color-text)] placeholder:text-[var(--color-text-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          />
        </div>
        <div className="flex flex-none items-center gap-0.5 rounded-[var(--radius-pill)] bg-[var(--color-fill-subtle)] p-0.5">
          <button
            type="button"
            onClick={() => setView("grid")}
            title="Grid view"
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-[var(--radius-pill)] transition-colors",
              view === "grid" ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-card)]" : "text-[var(--color-text-muted)]",
            )}
          >
            <LayoutGrid size={14} />
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            title="List view"
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-[var(--radius-pill)] transition-colors",
              view === "list" ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-card)]" : "text-[var(--color-text-muted)]",
            )}
          >
            <ListIcon size={14} />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <p className="text-[12.5px] text-[var(--color-text-muted)]">
            {query ? `No vehicles match "${query}".` : "Nothing in inventory yet — import a stock list above."}
          </p>
        </Card>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((v) => (
            <GridCard key={v.id} v={v} />
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-[var(--color-header-rule)] text-left text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
                  <th className="w-14 px-2 py-2"></th>
                  <th className="px-2 py-2">Vehicle</th>
                  <th className="px-2 py-2">Color</th>
                  <th className="px-2 py-2">Miles</th>
                  <th className="px-2 py-2">Days at lot</th>
                  <th className="px-2 py-2">Cost</th>
                  <th className="px-2 py-2">Asking</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <ListRow key={v.id} v={v} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function GridCard({ v }: { v: InventoryVehicleCard }) {
  return (
    <Card className="relative flex flex-col overflow-hidden p-0">
      <Link href={`/inventory/${v.id}`} className="absolute inset-0 z-0" aria-label={`Open ${v.label || "vehicle"}`} />

      <div className="relative aspect-[4/3] w-full bg-[var(--color-fill-subtle)]">
        {v.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.coverUrl} alt={v.label || "Vehicle photo"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Car size={18} className="text-[var(--color-text-placeholder)]" />
          </div>
        )}
        <div className="absolute right-1.5 top-1.5">
          <VehicleGalleryButton photos={v.photos} label={v.label || "Vehicle"} />
        </div>
        <div className="absolute left-1.5 top-1.5">
          <Badge tone={v.sold ? "neutral" : "positive"} className="px-1.5 py-0.5 text-[9px]">
            {v.sold ? "Sold" : "In stock"}
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <div>
          <div className="truncate text-[12px] font-semibold text-[var(--color-text)]">{v.label || "Vehicle"}</div>
          <div className="truncate text-[10px] text-[var(--color-text-muted)]">{v.stockNumber ? `#${v.stockNumber}` : v.vin ?? "—"}</div>
        </div>

        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10.5px]">
          <div className="flex justify-between text-[var(--color-text-muted)]">
            <span>Color</span>
            <span className="truncate font-medium text-[var(--color-text)]">{v.color ?? "—"}</span>
          </div>
          <div className="flex justify-between text-[var(--color-text-muted)]">
            <span>Miles</span>
            <span className="tabular-nums font-medium text-[var(--color-text)]">{v.miles != null ? v.miles.toLocaleString() : "—"}</span>
          </div>
          <div className="flex justify-between text-[var(--color-text-muted)]">
            <span>Days</span>
            <span className="tabular-nums font-medium text-[var(--color-text)]">{v.daysAtLot != null ? `${v.daysAtLot}d` : "—"}</span>
          </div>
          <div className="flex justify-between text-[var(--color-text-muted)]">
            <span>Cost</span>
            <span className="tabular-nums font-medium text-[var(--color-text)]">{formatCents(v.costCents)}</span>
          </div>
        </div>

        <div className="flex items-baseline justify-between border-t border-[var(--color-hairline)] pt-1 text-[11px]">
          <span className="text-[var(--color-text-muted)]">Asking</span>
          <span className="tabular-nums font-semibold text-[var(--color-text)]">{formatCents(v.askingCents)}</span>
        </div>

        <form action={markVehicleSold.bind(null, v.id, !v.sold)} className="relative z-10 mt-auto">
          <Button type="submit" variant="secondary" className="w-full px-2 py-1 text-[10.5px]">
            {v.sold ? "Mark in stock" : "Mark sold"}
          </Button>
        </form>
      </div>
    </Card>
  );
}

function ListRow({ v }: { v: InventoryVehicleCard }) {
  return (
    <tr className="border-b border-[var(--color-hairline)] hover:bg-[var(--color-row-hover)]">
      <td className="px-2 py-1.5">
        <Link href={`/inventory/${v.id}`} className="block h-10 w-10 overflow-hidden rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)]">
          {v.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.coverUrl} alt={v.label || "Vehicle"} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Car size={14} className="text-[var(--color-text-placeholder)]" />
            </div>
          )}
        </Link>
      </td>
      <td className="px-2 py-1.5">
        <Link href={`/inventory/${v.id}`} className="font-medium text-[var(--color-text)] hover:underline">
          {v.label || "Vehicle"}
        </Link>
        <div className="text-[11px] text-[var(--color-text-muted)]">{v.stockNumber ? `#${v.stockNumber}` : v.vin ?? "—"}</div>
      </td>
      <td className="px-2 py-1.5 text-[var(--color-text-muted)]">{v.color ?? "—"}</td>
      <td className="px-2 py-1.5 tabular-nums text-[var(--color-text-muted)]">{v.miles != null ? v.miles.toLocaleString() : "—"}</td>
      <td className="px-2 py-1.5 tabular-nums text-[var(--color-text-muted)]">{v.daysAtLot != null ? `${v.daysAtLot}d` : "—"}</td>
      <td className="px-2 py-1.5 tabular-nums text-[var(--color-text-muted)]">{formatCents(v.costCents)}</td>
      <td className="px-2 py-1.5 tabular-nums text-[var(--color-text)]">{formatCents(v.askingCents)}</td>
      <td className="px-2 py-1.5">
        <Badge tone={v.sold ? "neutral" : "positive"}>{v.sold ? "Sold" : "In stock"}</Badge>
      </td>
      <td className="px-2 py-1.5">
        <form action={markVehicleSold.bind(null, v.id, !v.sold)}>
          <Button type="submit" variant="secondary" className="px-2 py-1 text-[11px]">
            {v.sold ? "Mark in stock" : "Mark sold"}
          </Button>
        </form>
      </td>
    </tr>
  );
}
