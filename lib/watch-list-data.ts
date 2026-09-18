import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  avgTurnDays,
  bidPlan,
  compStats,
  lenderCappedRetail,
  type BidPlan,
  type House,
} from "@/schema-sketch/bid-math";

export interface PricingContext {
  targetGross: number;
  assumedDown: number;
  holdingCost: number;
  turnDays: number;
  holdingPerDay: number;
  bestAdvancePct: number | null;
}

/**
 * Shared with Auction day (app/sourcing/auction-day/actions.ts) so the
 * max bid recorded on a bought/lost comp is computed exactly the same way
 * as the number the operator was shown on screen — one formula, one place.
 */
export async function getPricingContext(): Promise<PricingContext> {
  const [settingsRow] = await db.select().from(schema.settings).limit(1);
  const settings = settingsRow ?? {
    targetGross: 320_000,
    assumedDown: 150_000,
    holdingCostPerDay: 1_200,
    laneBudget: null as number | null,
  };

  const fundedDeals = await db
    .select({ acquiredOn: schema.vehicles.acquiredOn, fundedOn: schema.deals.fundedOn })
    .from(schema.deals)
    .innerJoin(schema.vehicles, eq(schema.deals.vehicleId, schema.vehicles.id))
    .where(eq(schema.deals.funded, true));
  const turnDays = avgTurnDays(fundedDeals);
  const holdingCost = turnDays * settings.holdingCostPerDay;

  const programs = await db.select().from(schema.lenderPrograms);
  const bestAdvancePct = programs.length ? Math.max(...programs.map((p) => p.advancePct)) : null;

  return {
    targetGross: settings.targetGross,
    assumedDown: settings.assumedDown,
    holdingCost,
    turnDays,
    holdingPerDay: settings.holdingCostPerDay,
    bestAdvancePct,
  };
}

export function planForWatchItem(
  item: { retail: number | null; reconEstimate: number; house: string },
  ctx: PricingContext,
): { plan: BidPlan | null; cappedRetail: number | null } {
  let retail = item.retail ?? 0;
  let cappedRetail: number | null = null;
  if (ctx.bestAdvancePct != null && item.retail != null) {
    const capped = lenderCappedRetail(item.retail, ctx.bestAdvancePct, ctx.assumedDown);
    if (capped < retail) {
      cappedRetail = capped;
      retail = capped;
    }
  }

  const plan = item.retail
    ? bidPlan({
        house: item.house as House,
        retail,
        targetGross: ctx.targetGross,
        recon: item.reconEstimate,
        holdingCost: ctx.holdingCost,
      })
    : null;

  return { plan, cappedRetail };
}

export async function getWatchListData() {
  const ctx = await getPricingContext();

  const items = await db
    .select()
    .from(schema.watchItems)
    .orderBy(schema.watchItems.saleDate, schema.watchItems.runNumber);

  const comps = await db
    .select({
      make: schema.saleComps.make,
      model: schema.saleComps.model,
      soldFor: schema.saleComps.soldFor,
      ourMaxBid: schema.saleComps.ourMaxBid,
      won: schema.saleComps.won,
      observedOn: schema.saleComps.observedOn,
    })
    .from(schema.saleComps);

  return {
    turnDays: ctx.turnDays,
    holdingPerDay: ctx.holdingPerDay,
    rows: items.map((item) => {
      const { plan, cappedRetail } = planForWatchItem(item, ctx);
      const stats = compStats(comps, item.make, item.model);
      return { item, plan, stats, cappedRetail };
    }),
  };
}

export type WatchListRow = Awaited<ReturnType<typeof getWatchListData>>["rows"][number];
