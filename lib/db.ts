import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/schema-sketch/schema";

declare global {
  var __dealDeskPool: Pool | undefined;
}

// Reused across hot reloads in dev so we don't open a new pool per edit.
const pool =
  global.__dealDeskPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  global.__dealDeskPool = pool;
}

export const db = drizzle(pool, { schema });
export { schema };
