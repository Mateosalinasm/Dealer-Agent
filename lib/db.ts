import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/schema-sketch/schema";

declare global {
  var __dealDeskPool: Pool | undefined;
}

// Reused across hot reloads in dev so we don't open a new pool per edit.
const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "");

const pool =
  global.__dealDeskPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // Supabase's pooler requires SSL; local Postgres doesn't offer it.
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
    // A single operator generates very little real concurrency — a small
    // pool avoids opening more connections against Supabase's own pgbouncer
    // pooler than this app will ever use at once. keepAlive stops those
    // connections from going stale and needing a fresh TLS handshake (the
    // main source of the "click a deal, wait a second" lag) the next time a
    // warm serverless instance reuses this pool after sitting idle.
    max: 5,
    keepAlive: true,
    connectionTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== "production") {
  global.__dealDeskPool = pool;
}

export const db = drizzle(pool, { schema });
export { schema };
