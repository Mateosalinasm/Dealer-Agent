// Dev-only seed data for the local Postgres instance.
// Run with: npm run db:seed

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ?? "postgresql://dealdesk:dealdesk@localhost:5432/dealdesk_sourcing",
});
const db = drizzle(pool, { schema });

async function main() {
  console.log("Clearing existing data...");
  await db.delete(schema.saleComps);
  await db.delete(schema.watchItems);
  await db.delete(schema.leads);
  await db.delete(schema.deals);
  await db.delete(schema.vehicles);
  await db.delete(schema.lenderPrograms);
  await db.delete(schema.lenders);
  await db.delete(schema.settings);

  await db.insert(schema.settings).values({});

  const [veros] = await db.insert(schema.lenders).values({ name: "Veros" }).returning();
  const [westlake] = await db.insert(schema.lenders).values({ name: "Westlake" }).returning();
  const [uac] = await db.insert(schema.lenders).values({ name: "United Auto Credit" }).returning();

  await db.insert(schema.lenderPrograms).values([
    {
      lenderId: veros.id,
      label: "Standard",
      advancePct: 90,
      maxLtvPct: 125,
      maxTermMonths: 60,
      maxMiles: 120_000,
      maxAgeYears: 10,
      allowedTitles: ["clean", "rebuilt"],
      minCreditScore: 560,
      maxPtiPct: 20,
      typicalAprBps: 1899,
    },
    {
      lenderId: westlake.id,
      label: "Near-prime",
      advancePct: 110,
      maxLtvPct: 135,
      maxTermMonths: 72,
      maxMiles: 100_000,
      maxAgeYears: 8,
      allowedTitles: ["clean"],
      minCreditScore: 600,
      maxPtiPct: 17,
      typicalAprBps: 1599,
    },
    {
      lenderId: uac.id,
      label: "Deep subprime",
      advancePct: 85,
      maxLtvPct: 120,
      maxTermMonths: 60,
      maxMiles: 130_000,
      maxAgeYears: 12,
      allowedTitles: ["clean", "rebuilt", "salvage"],
      minCreditScore: 500,
      maxPtiPct: 22,
      typicalAprBps: 2399,
    },
  ]);

  await db.insert(schema.watchItems).values([
    {
      house: "manheim",
      runNumber: "42",
      saleDate: "2026-09-25",
      year: 2021,
      make: "Honda",
      model: "Civic",
      trim: "EX",
      miles: 41_200,
      vin: "2HGFC2F59MH123456",
      title: "clean",
      retail: 1_800_000,
      wholesale: 1_400_000,
      reconEstimate: 25_000,
      announcements: null,
      note: null,
    },
    {
      house: "iaa",
      runNumber: "108",
      saleDate: "2026-09-25",
      year: 2019,
      make: "Chevrolet",
      model: "Equinox",
      trim: "LT",
      miles: 68_900,
      vin: "2GNAXUEV5K6123456",
      title: "salvage",
      retail: 1_450_000,
      wholesale: 1_050_000,
      reconEstimate: 180_000,
      announcements: "Front end damage per CR",
      note: "Watch for frame",
    },
    {
      house: "americas",
      runNumber: null,
      saleDate: "2026-10-02",
      year: 2020,
      make: "Honda",
      model: "Civic",
      trim: "LX",
      miles: 55_400,
      vin: "19XFC2F59LE123456",
      title: "clean",
      retail: 1_650_000,
      wholesale: 1_250_000,
      reconEstimate: 15_000,
      announcements: null,
      note: null,
    },
  ]);

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

  await pool.end();
  console.log("Seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
