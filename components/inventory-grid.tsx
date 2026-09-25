"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Car, Fuel, LayoutGrid, List as ListIcon, OctagonAlert, Search, Trash2, TriangleAlert, Users } from "lucide-react";
import { IconCar, IconCarSuv } from "@tabler/icons-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { VehicleGalleryButton, type GalleryPhoto } from "@/components/vehicle-gallery-button";
import { PickupTruckIcon } from "@/components/icons/pickup-truck-icon";
import { deleteVehicles, markVehicleSold } from "@/app/inventory/actions";
import { formatCents, cn } from "@/lib/utils";

type BodyType = "truck" | "sedan" | "suv";
type FuelType = "gas" | "diesel" | "hybrid" | "electric";
type TitleStatus = "clean" | "salvage" | "rebuilt" | "flood" | "lemon" | "branded";

export interface InventoryVehicleCard {
  id: string;
  label: string;
  stockNumber: string | null;
  vin: string | null;
  color: string | null;
  miles: number | null;
  year: number | null;
  daysAtLot: number | null;
  costCents: number;
  askingCents: number | null;
  sold: boolean;
  coverUrl: string | null;
  photos: GalleryPhoto[];
  hasDeal: boolean;
  bodyType: BodyType | null;
  fuelType: FuelType;
  isThreeRowSuv: boolean;
  title: TitleStatus;
}

type ViewMode = "grid" | "list";
type Category = "all" | BodyType;
type SortOrder = "none" | "lotNewest" | "lotOldest" | "yearNewest" | "yearOldest";
type StockTab = "stock" | "sold";

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;
const CATEGORY_ICONS: Record<BodyType, IconComponent> = { sedan: IconCar, truck: PickupTruckIcon, suv: IconCarSuv };
const CATEGORY_LABELS: Record<BodyType, string> = { sedan: "Sedans", truck: "Trucks", suv: "SUVs" };

// Only 'salvage' gets the red danger treatment, matching the explicit ask.
// Every other non-clean brand (rebuilt/flood/lemon/branded — "insurance
// loss" isn't its own column in the schema, it lands under one of these)
// gets the amber warning icon instead. Both reuse existing design-system
// color tokens (--color-negative / --color-caution-text) rather than new
// hex values, per CLAUDE.md.
function titleBadge(title: TitleStatus): { Icon: IconComponent; className: string; label: string } | null {
  if (title === "clean") return null;
  if (title === "salvage") return { Icon: OctagonAlert, className: "bg-[var(--color-negative)] text-white", label: "Salvage title" };
  const label = title.charAt(0).toUpperCase() + title.slice(1);
  return { Icon: TriangleAlert, className: "bg-[var(--color-caution-text)] text-white", label: `${label} title` };
}

export function InventoryGrid({ vehicles }: { vehicles: InventoryVehicleCard[] }) {
  const [tab, setTab] = useState<StockTab>("stock");
  const [view, setView] = useState<ViewMode>("grid");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [dieselOnly, setDieselOnly] = useState(false);
  const [threeRowOnly, setThreeRowOnly] = useState(false);
  const [sort, setSort] = useState<SortOrder>("none");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, startDelete] = useTransition();

  const stockCount = useMemo(() => vehicles.filter((v) => !v.sold).length, [vehicles]);
  const soldCount = vehicles.length - stockCount;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = vehicles.filter((v) => (tab === "sold" ? v.sold : !v.sold));
    if (category !== "all") list = list.filter((v) => v.bodyType === category);
    if (dieselOnly) list = list.filter((v) => v.fuelType === "diesel");
    if (threeRowOnly) list = list.filter((v) => v.isThreeRowSuv);
    if (q) list = list.filter((v) => [v.label, v.stockNumber, v.vin, v.color].filter(Boolean).some((f) => f!.toLowerCase().includes(q)));
    if (sort === "lotNewest" || sort === "lotOldest") {
      list = [...list].sort((a, b) => {
        // Fewest days at lot = most recently acquired = "newest"; vehicles
        // with no acquired date sort last regardless of direction.
        if (a.daysAtLot == null) return 1;
        if (b.daysAtLot == null) return -1;
        return sort === "lotNewest" ? a.daysAtLot - b.daysAtLot : b.daysAtLot - a.daysAtLot;
      });
    } else if (sort === "yearNewest" || sort === "yearOldest") {
      list = [...list].sort((a, b) => {
        if (a.year == null) return 1;
        if (b.year == null) return -1;
        return sort === "yearNewest" ? b.year - a.year : a.year - b.year;
      });
    }
    return list;
  }, [vehicles, tab, query, category, dieselOnly, threeRowOnly, sort]);

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelected(new Set());
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((v) => v.id))));
  }

  const selectedVehicles = vehicles.filter((v) => selected.has(v.id));
  const selectedWithDeal = selectedVehicles.filter((v) => v.hasDeal).length;

  function confirmDelete() {
    startDelete(async () => {
      await deleteVehicles([...selected]);
      setConfirmOpen(false);
      setSelectMode(false);
      setSelected(new Set());
    });
  }

  function switchTab(next: StockTab) {
    setTab(next);
    setSelectMode(false);
    setSelected(new Set());
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-none items-center gap-0.5 rounded-[var(--radius-pill)] bg-[var(--color-fill-subtle)] p-0.5">
          <button
            type="button"
            onClick={() => switchTab("stock")}
            className={cn(
              "rounded-[var(--radius-pill)] px-2.5 py-1 text-[11px] font-semibold transition-colors",
              tab === "stock" ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-card)]" : "text-[var(--color-text-muted)]",
            )}
          >
            In stock · {stockCount}
          </button>
          <button
            type="button"
            onClick={() => switchTab("sold")}
            className={cn(
              "rounded-[var(--radius-pill)] px-2.5 py-1 text-[11px] font-semibold transition-colors",
              tab === "sold" ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-card)]" : "text-[var(--color-text-muted)]",
            )}
          >
            Sold · {soldCount}
          </button>
        </div>
        <div className="flex flex-none items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-fill-subtle)] p-0.5">
          <button
            type="button"
            onClick={() => setCategory("all")}
            title="All body types"
            className={cn(
              "rounded-[var(--radius-pill)] px-2.5 py-1 text-[11px] font-semibold transition-colors",
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
        <button
          type="button"
          onClick={() => setDieselOnly((v) => !v)}
          title="Diesel only"
          className={cn(
            "flex flex-none items-center gap-1 rounded-[var(--radius-pill)] border px-2.5 py-1 text-[11px] font-semibold transition-colors",
            dieselOnly ? "border-[var(--color-primary)] bg-[var(--color-info-bg)] text-[var(--color-info-text)]" : "border-[var(--color-hairline)] text-[var(--color-text-muted)]",
          )}
        >
          <Fuel size={12} /> Diesel
        </button>
        <button
          type="button"
          onClick={() => setThreeRowOnly((v) => !v)}
          title="Three-row SUVs only"
          className={cn(
            "flex flex-none items-center gap-1 rounded-[var(--radius-pill)] border px-2.5 py-1 text-[11px] font-semibold transition-colors",
            threeRowOnly ? "border-[var(--color-primary)] bg-[var(--color-info-bg)] text-[var(--color-info-text)]" : "border-[var(--color-hairline)] text-[var(--color-text-muted)]",
          )}
        >
          <Users size={12} /> 3-row
        </button>
      </div>

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
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOrder)}
          className="flex-none rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-1.5 text-[12px] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
        >
          <option value="none">Sort: default</option>
          <option value="lotNewest">Days at lot: fewest first</option>
          <option value="lotOldest">Days at lot: most first</option>
          <option value="yearNewest">Year: newest first</option>
          <option value="yearOldest">Year: oldest first</option>
        </select>
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
        <Button type="button" variant={selectMode ? "secondary" : "ghost"} onClick={toggleSelectMode} className="flex-none px-3 py-1.5 text-[12px]">
          {selectMode ? "Cancel" : "Select"}
        </Button>
      </div>

      {selectMode && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)] px-3 py-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-[12px] font-medium text-[var(--color-text)]">
            <input
              type="checkbox"
              checked={filtered.length > 0 && selected.size === filtered.length}
              onChange={toggleAll}
              className="h-3.5 w-3.5 rounded accent-[var(--color-primary)]"
            />
            Select all {filtered.length > 0 ? `(${filtered.length})` : ""}
          </label>
          <span className="text-[12px] text-[var(--color-text-muted)]">{selected.size} selected</span>
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="destructive" disabled={selected.size === 0} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[12px]">
                <Trash2 size={13} /> Delete {selected.size > 0 ? selected.size : ""}
              </Button>
            </DialogTrigger>
            <DialogContent title="Delete vehicles" className="max-w-sm">
              <p className="text-[13px] text-[var(--color-text)]">
                Delete {selected.size} vehicle{selected.size === 1 ? "" : "s"}? This removes their photos too, and can&rsquo;t be undone.
              </p>
              {selectedWithDeal > 0 && (
                <p className="mt-2 rounded-[var(--radius-panel)] bg-[var(--color-caution-bg)] p-2.5 text-[11.5px] text-[var(--color-caution-text)]">
                  {selectedWithDeal} of these {selectedWithDeal === 1 ? "has" : "have"} a deal on file. The deal itself won&rsquo;t be deleted — it&rsquo;ll just lose its vehicle link.
                </p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setConfirmOpen(false)} disabled={isDeleting}>
                  Cancel
                </Button>
                <Button type="button" variant="destructive" onClick={confirmDelete} disabled={isDeleting} className="bg-[var(--color-negative-bg)] text-[var(--color-negative-text)]">
                  {isDeleting ? "Deleting…" : `Delete ${selected.size}`}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <p className="text-[12.5px] text-[var(--color-text-muted)]">
            {query || category !== "all" || dieselOnly || threeRowOnly
              ? "No vehicles match these filters."
              : tab === "sold"
                ? "No sold vehicles yet."
                : "Nothing in inventory yet — import a stock list above."}
          </p>
        </Card>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((v) => (
            <GridCard key={v.id} v={v} selectMode={selectMode} selected={selected.has(v.id)} onToggle={toggleOne} />
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-[var(--color-header-rule)] text-left text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
                  {selectMode && <th className="w-8 px-2 py-2"></th>}
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
                  <ListRow key={v.id} v={v} selectMode={selectMode} selected={selected.has(v.id)} onToggle={toggleOne} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function TitleStatusBadge({ title }: { title: TitleStatus }) {
  const badge = titleBadge(title);
  if (!badge) return null;
  const { Icon, className, label } = badge;
  return (
    <span title={label} className={cn("flex h-5 w-5 flex-none items-center justify-center rounded-full", className)}>
      <Icon size={11} />
    </span>
  );
}

function GridCard({ v, selectMode, selected, onToggle }: { v: InventoryVehicleCard; selectMode: boolean; selected: boolean; onToggle: (id: string) => void }) {
  return (
    <Card className={cn("relative flex flex-col overflow-hidden p-0", selected && "ring-2 ring-[var(--color-primary)]")}>
      {selectMode ? (
        <button type="button" onClick={() => onToggle(v.id)} className="absolute inset-0 z-0" aria-label={`Select ${v.label || "vehicle"}`} />
      ) : (
        <Link href={`/inventory/${v.id}`} className="absolute inset-0 z-0" aria-label={`Open ${v.label || "vehicle"}`} />
      )}

      <div className="relative w-full overflow-hidden bg-[var(--color-fill-subtle)] aspect-[3/4]">
        {v.coverUrl ? (
          // A fixed 3:4 (iPhone-vertical-photo) box so every card is the
          // same size, but object-contain — not object-cover — so the
          // photo itself is never cropped or stretched to fill it. A
          // photo shorter or wider than 3:4 just sits at its own natural
          // proportions inside the box with blank space taking up the
          // rest, instead of distorting the picture to match its neighbors.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.coverUrl} alt={v.label || "Vehicle photo"} className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Car size={18} className="text-[var(--color-text-placeholder)]" />
          </div>
        )}
        {selectMode ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(v.id)}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-1.5 top-1.5 z-10 h-4 w-4 rounded accent-[var(--color-primary)]"
          />
        ) : (
          <div className="absolute right-1.5 top-1.5">
            <VehicleGalleryButton photos={v.photos} label={v.label || "Vehicle"} />
          </div>
        )}
        <div className="absolute left-1.5 top-1.5 flex items-center gap-1">
          <Badge tone={v.sold ? "neutral" : "positive"} className="px-1.5 py-0.5 text-[9px]">
            {v.sold ? "Sold" : "In stock"}
          </Badge>
          <TitleStatusBadge title={v.title} />
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

        {!selectMode && (
          <form action={markVehicleSold.bind(null, v.id, !v.sold)} className="relative z-10 mt-auto">
            <Button type="submit" variant="secondary" className="w-full px-2 py-1 text-[10.5px]">
              {v.sold ? "Mark in stock" : "Mark sold"}
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}

function ListRow({ v, selectMode, selected, onToggle }: { v: InventoryVehicleCard; selectMode: boolean; selected: boolean; onToggle: (id: string) => void }) {
  return (
    <tr className={cn("border-b border-[var(--color-hairline)] hover:bg-[var(--color-row-hover)]", selected && "bg-[var(--color-info-bg)]")}>
      {selectMode && (
        <td className="px-2 py-1.5">
          <input type="checkbox" checked={selected} onChange={() => onToggle(v.id)} className="h-3.5 w-3.5 rounded accent-[var(--color-primary)]" />
        </td>
      )}
      <td className="px-2 py-1.5">
        {selectMode ? (
          <button
            type="button"
            onClick={() => onToggle(v.id)}
            className="block h-10 w-10 overflow-hidden rounded-[var(--radius-panel)] bg-[var(--color-fill-subtle)]"
          >
            {v.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.coverUrl} alt={v.label || "Vehicle"} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Car size={14} className="text-[var(--color-text-placeholder)]" />
              </div>
            )}
          </button>
        ) : (
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
        )}
      </td>
      <td className="px-2 py-1.5">
        {selectMode ? (
          <button type="button" onClick={() => onToggle(v.id)} className="text-left font-medium text-[var(--color-text)]">
            {v.label || "Vehicle"}
          </button>
        ) : (
          <Link href={`/inventory/${v.id}`} className="font-medium text-[var(--color-text)] hover:underline">
            {v.label || "Vehicle"}
          </Link>
        )}
        <div className="text-[11px] text-[var(--color-text-muted)]">{v.stockNumber ? `#${v.stockNumber}` : v.vin ?? "—"}</div>
      </td>
      <td className="px-2 py-1.5 text-[var(--color-text-muted)]">{v.color ?? "—"}</td>
      <td className="px-2 py-1.5 tabular-nums text-[var(--color-text-muted)]">{v.miles != null ? v.miles.toLocaleString() : "—"}</td>
      <td className="px-2 py-1.5 tabular-nums text-[var(--color-text-muted)]">{v.daysAtLot != null ? `${v.daysAtLot}d` : "—"}</td>
      <td className="px-2 py-1.5 tabular-nums text-[var(--color-text-muted)]">{formatCents(v.costCents)}</td>
      <td className="px-2 py-1.5 tabular-nums text-[var(--color-text)]">{formatCents(v.askingCents)}</td>
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <Badge tone={v.sold ? "neutral" : "positive"}>{v.sold ? "Sold" : "In stock"}</Badge>
          <TitleStatusBadge title={v.title} />
        </div>
      </td>
      <td className="px-2 py-1.5">
        {!selectMode && (
          <form action={markVehicleSold.bind(null, v.id, !v.sold)}>
            <Button type="submit" variant="secondary" className="px-2 py-1 text-[11px]">
              {v.sold ? "Mark in stock" : "Mark sold"}
            </Button>
          </form>
        )}
      </td>
    </tr>
  );
}
