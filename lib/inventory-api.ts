import "server-only";
import { and, eq, gte, ilike, lte, type SQL } from "drizzle-orm";
import { db, schema } from "@/lib/db";

// The inventory search surface every channel (WhatsApp today, website/FB/IG
// chat later) reads through — one function, one set of rules, rather than
// each integration writing its own query. Internal storage stays integer
// cents everywhere else in this app; this module is an external API
// boundary, so amounts here are plain whole dollars — the conversion
// happens only at this edge, not sprinkled through callers.

export interface InventorySearchParams {
  make?: string;
  model?: string;
  minYear?: number;
  maxYear?: number;
  maxPriceDollars?: number;
  maxMiles?: number;
  inStockOnly?: boolean; // default true
  limit?: number; // default 20, capped at 50
}

export interface InventoryResult {
  id: string;
  stockNumber: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  color: string | null;
  miles: number | null;
  title: string;
  askingPriceDollars: number | null;
  daysAtLot: number | null;
}

function daysAtLot(acquiredOn: string | null): number | null {
  if (!acquiredOn) return null;
  const days = Math.floor((Date.now() - new Date(acquiredOn + "T00:00:00").getTime()) / 86_400_000);
  return days >= 0 ? days : null;
}

export async function searchInventory(params: InventorySearchParams): Promise<InventoryResult[]> {
  const conditions: SQL[] = [];
  if (params.inStockOnly !== false) conditions.push(eq(schema.vehicles.sold, false));
  if (params.make) conditions.push(ilike(schema.vehicles.make, `%${params.make}%`));
  if (params.model) conditions.push(ilike(schema.vehicles.model, `%${params.model}%`));
  if (params.minYear != null) conditions.push(gte(schema.vehicles.year, params.minYear));
  if (params.maxYear != null) conditions.push(lte(schema.vehicles.year, params.maxYear));
  if (params.maxMiles != null) conditions.push(lte(schema.vehicles.miles, params.maxMiles));
  if (params.maxPriceDollars != null) {
    conditions.push(lte(schema.vehicles.askingPrice, Math.round(params.maxPriceDollars * 100)));
  }

  const limit = Math.max(1, Math.min(params.limit ?? 20, 50));

  const rows = await db
    .select()
    .from(schema.vehicles)
    .where(conditions.length ? and(...conditions) : undefined)
    .limit(limit);

  return rows.map((v) => ({
    id: v.id,
    stockNumber: v.stockNumber,
    year: v.year,
    make: v.make,
    model: v.model,
    trim: v.trim,
    color: v.color,
    miles: v.miles,
    title: v.title,
    askingPriceDollars: v.askingPrice != null ? v.askingPrice / 100 : null,
    daysAtLot: daysAtLot(v.acquiredOn),
  }));
}

export async function getVehicleById(id: string): Promise<InventoryResult | null> {
  const [v] = await db.select().from(schema.vehicles).where(eq(schema.vehicles.id, id)).limit(1);
  if (!v) return null;
  return {
    id: v.id,
    stockNumber: v.stockNumber,
    year: v.year,
    make: v.make,
    model: v.model,
    trim: v.trim,
    color: v.color,
    miles: v.miles,
    title: v.title,
    askingPriceDollars: v.askingPrice != null ? v.askingPrice / 100 : null,
    daysAtLot: daysAtLot(v.acquiredOn),
  };
}
