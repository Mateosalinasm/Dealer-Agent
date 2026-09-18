"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { getPricingContext, planForWatchItem } from "@/lib/watch-list-data";
import { getDealershipTimezone, todayInTimezone } from "@/lib/dealership-time";
import { buyFee, landedCost, type House } from "@/schema-sketch/bid-math";

function revalidateAuctionDayViews() {
  revalidatePath("/sourcing/auction-day");
  revalidatePath("/sourcing/watch-list");
  revalidatePath("/sourcing/sale-ledger");
  revalidatePath("/inventory");
}

export async function setLaneBudget(cents: number | null) {
  const [existing] = await db.select().from(schema.settings).limit(1);
  if (existing) {
    await db.update(schema.settings).set({ laneBudget: cents }).where(eq(schema.settings.id, existing.id));
  } else {
    await db.insert(schema.settings).values({ laneBudget: cents });
  }
  revalidatePath("/sourcing/auction-day");
}

export async function setDealershipTimezone(timezone: string) {
  const [existing] = await db.select().from(schema.settings).limit(1);
  if (existing) {
    await db.update(schema.settings).set({ timezone }).where(eq(schema.settings.id, existing.id));
  } else {
    await db.insert(schema.settings).values({ timezone });
  }
  revalidatePath("/sourcing/auction-day");
}

export async function logAuctionResult(watchItemId: string, outcome: "bought" | "lost", priceDollars: number) {
  const [item] = await db.select().from(schema.watchItems).where(eq(schema.watchItems.id, watchItemId)).limit(1);
  if (!item) return;

  const ctx = await getPricingContext();
  const { plan } = planForWatchItem(item, ctx);
  const priceCents = Math.round(priceDollars * 100);
  const today = todayInTimezone(await getDealershipTimezone());

  // One unit of work: either every write lands (vehicle + comp + watch-item
  // removal) or none do. Without this, a dropped connection mid-sequence —
  // not unlikely on auction wifi — could leave a bought vehicle with no
  // matching sale_comps row, or a watch item that's already been logged
  // still sitting on the board.
  await db.transaction(async (tx) => {
    if (outcome === "bought") {
      const house = item.house as House;
      const fee = buyFee(house, priceCents);
      const landed = landedCost(house, priceCents, item.reconEstimate);

      await tx.insert(schema.vehicles).values({
        vin: item.vin,
        year: item.year,
        make: item.make,
        model: item.model,
        trim: item.trim,
        miles: item.miles,
        title: item.title,
        house: item.house,
        runNumber: item.runNumber,
        acquiredOn: today,
        hammer: priceCents,
        buyFee: fee,
        recon: item.reconEstimate,
        bookValue: item.retail,
        notes: item.note,
      });

      await tx.insert(schema.saleComps).values({
        observedOn: today,
        house: item.house,
        runNumber: item.runNumber,
        year: item.year,
        make: item.make,
        model: item.model,
        trim: item.trim,
        miles: item.miles,
        title: item.title,
        soldFor: priceCents,
        ourMaxBid: plan?.maxBid ?? null,
        landedCost: landed,
        won: true,
      });
    } else {
      await tx.insert(schema.saleComps).values({
        observedOn: today,
        house: item.house,
        runNumber: item.runNumber,
        year: item.year,
        make: item.make,
        model: item.model,
        trim: item.trim,
        miles: item.miles,
        title: item.title,
        soldFor: priceCents,
        ourMaxBid: plan?.maxBid ?? null,
        won: false,
      });
    }

    await tx.delete(schema.watchItems).where(eq(schema.watchItems.id, watchItemId));
  });

  revalidateAuctionDayViews();
}
