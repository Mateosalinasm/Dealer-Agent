import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { avgTurnDays } from "@/schema-sketch/bid-math";

export async function getRunListContext() {
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

  const [leads, vehicles, comps] = await Promise.all([
    db
      .select({ wantMake: schema.leads.wantMake, wantModel: schema.leads.wantModel, wants: schema.leads.wants })
      .from(schema.leads),
    db.select({ make: schema.vehicles.make, model: schema.vehicles.model, sold: schema.vehicles.sold }).from(schema.vehicles),
    db
      .select({
        make: schema.saleComps.make,
        model: schema.saleComps.model,
        soldFor: schema.saleComps.soldFor,
        ourMaxBid: schema.saleComps.ourMaxBid,
        won: schema.saleComps.won,
        observedOn: schema.saleComps.observedOn,
      })
      .from(schema.saleComps),
  ]);

  return {
    targetGross: settings.targetGross,
    recon: 0,
    holdingCost,
    turnDays,
    holdingPerDay: settings.holdingCostPerDay,
    leads,
    vehicles,
    comps,
  };
}
