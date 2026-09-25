import "server-only";
import { db, schema } from "@/lib/db";

// Placeholder until set on the Auction day screen — a real dealership
// timezone, not a guess at the operator's actual one. Every date boundary
// in Sourcing should go through this module rather than `new Date()`
// directly: the server (Vercel) runs in UTC regardless of where the lane
// is, and computing "today" in UTC silently rolls over mid-evening for any
// US timezone, which is exactly when an auction is still running.
const DEFAULT_TIMEZONE = "America/Chicago";

export async function getDealershipTimezone(): Promise<string> {
  const [row] = await db.select({ timezone: schema.settings.timezone }).from(schema.settings).limit(1);
  return row?.timezone || DEFAULT_TIMEZONE;
}

/** Today's calendar date in the given IANA timezone, as YYYY-MM-DD. */
export function todayInTimezone(timezone: string): string {
  // en-CA formats as YYYY-MM-DD — the same shape Postgres date columns want.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** The given instant's calendar date in the timezone, as YYYY-MM-DD. */
export function dateInTimezone(timezone: string, at: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** The given instant's 24h clock time in the timezone, as "HH:mm". */
export function clockTimeInTimezone(timezone: string, at: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
}
