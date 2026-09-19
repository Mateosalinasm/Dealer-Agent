// Local smoke test for the authoritative sourcing schema + bid-math module
// (from the design handoff zip — supersedes the earlier placeholder sketch).
//
// Seeds settings + a lender/program, then exercises bidPlan() for a
// Manheim buy, a lender-capped IAA buy, and the sale_comps reads
// (compStats, outbidBy).
//
// Run with: npm run smoke-test

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import {
  avgTurnDays,
  bidPlan,
  compStats,
  lenderCappedRetail,
  outbidBy,
} from "./bid-math";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://dealdesk:dealdesk@localhost:5432/dealdesk_sourcing";
const pool = new Pool({
  connectionString,
  ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? undefined : { rejectUnauthorized: false },
});
const db = drizzle(pool, { schema });

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

async function main() {
  console.log("Resetting tables...");
  await db.delete(schema.saleComps);
  await db.delete(schema.watchItems);
  await db.delete(schema.leads);
  await db.delete(schema.deals);
  await db.delete(schema.vehicles);
  await db.delete(schema.lenderPrograms);
  await db.delete(schema.lenders);
  await db.delete(schema.settings);

  console.log("Seeding settings and a lender program...");
  const [settings] = await db
    .insert(schema.settings)
    .values({})
    .returning();

  const [lender] = await db.insert(schema.lenders).values({ name: "Veros" }).returning();
  const [program] = await db
    .insert(schema.lenderPrograms)
    .values({ lenderId: lender.id, label: "Standard", advancePct: 90 })
    .returning();

  console.log("\n--- Scenario 1: Manheim, real funding history not yet built up ---");
  const turnDays = avgTurnDays([]); // no funded deals yet -> DEFAULT_TURN_DAYS
  console.log(`avgTurnDays (fallback): ${turnDays}`);

  const manheimPlan = bidPlan({
    house: "manheim",
    retail: 1_800_000, // $18,000 realistic retail
    targetGross: settings.targetGross,
    recon: 0,
    holdingCost: turnDays * settings.holdingCostPerDay,
  });
  console.log(`Manheim max bid: ${fmt(manheimPlan!.maxBid)} (fee ${fmt(manheimPlan!.fee)}, landed at max ${fmt(manheimPlan!.landedAtMax)})`);

  console.log("\n--- Scenario 2: IAA, retail capped by the lender's advance rate ---");
  const bookValue = 1_800_000;
  const cappedRetail = lenderCappedRetail(bookValue, program.advancePct, settings.assumedDown);
  const uncappedPlan = bidPlan({
    house: "iaa",
    retail: bookValue,
    targetGross: settings.targetGross,
    recon: 50_000,
    holdingCost: turnDays * settings.holdingCostPerDay,
  });
  const cappedPlan = bidPlan({
    house: "iaa",
    retail: Math.min(bookValue, cappedRetail),
    targetGross: settings.targetGross,
    recon: 50_000,
    holdingCost: turnDays * settings.holdingCostPerDay,
  });
  console.log(`Lender-capped retail (90% advance + assumed down): ${fmt(cappedRetail)}`);
  console.log(`IAA max bid on book retail alone: ${fmt(uncappedPlan!.maxBid)}`);
  console.log(`IAA max bid using the lower of book retail / lender-capped retail: ${fmt(cappedPlan!.maxBid)}`);
  console.log(
    `  (${cappedRetail < bookValue ? "lender cap binds" : "lender cap does not bind"} here)`,
  );

  console.log("\n--- Scenario 3: sale_comps reads (won + lost) ---");
  await db.insert(schema.saleComps).values([
    {
      observedOn: "2026-08-01",
      house: "manheim",
      make: "Honda",
      model: "Civic",
      title: "clean",
      soldFor: 1_150_000,
      ourMaxBid: 1_200_000,
      landedCost: 1_240_000,
      won: true,
    },
    {
      observedOn: "2026-08-15",
      house: "manheim",
      make: "Honda",
      model: "Civic",
      title: "clean",
      soldFor: 1_225_000,
      ourMaxBid: 1_150_000,
      won: false,
    },
    {
      observedOn: "2026-09-01",
      house: "americas",
      make: "Honda",
      model: "Civic",
      title: "clean",
      soldFor: 1_240_000,
      ourMaxBid: 1_180_000,
      won: false,
    },
  ]);

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

  const stats = compStats(comps, "Honda", "Civic");
  const outbid = outbidBy(comps);
  console.log(`Honda Civic comp stats: n=${stats?.n}, avg=${fmt(stats!.avg)}, range=${fmt(stats!.lo)}-${fmt(stats!.hi)}, won=${stats?.won}, lastSeen=${stats?.lastSeen}`);
  console.log(`Outbid-by across all lost comps: n=${outbid?.n}, avg=${fmt(outbid!.avg)}`);

  await pool.end();
  console.log("\nSmoke test complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
