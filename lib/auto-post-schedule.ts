import "server-only";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { clockTimeInTimezone, dateInTimezone, todayInTimezone } from "@/lib/dealership-time";
import { getAppBaseUrl } from "@/lib/app-url";

export interface AutoPostJob {
  postId: string;
  vehicle: {
    year: number | null;
    make: string | null;
    model: string | null;
    trim: string | null;
    color: string | null;
    miles: number | null;
    askingPrice: number | null; // integer cents
    stockNumber: string | null;
    vin: string | null;
    bodyType: string | null;
    fuelType: string;
  };
  body: string;
  photoUrls: string[]; // absolute URLs, in cover-first order
}

export type DueResult = { due: true; job: AutoPostJob } | { due: false; reason: "disabled" | "not_time_yet" | "max_reached" | "nothing_queued" };

// Whether the extension has a job to run right now, and if so what it is.
// A slot only "opens up" once its configured time has passed for today —
// autoPostTimes.filter(time-has-passed).length is how many should have
// gone out by now; comparing that to how many actually did (postedVia
// 'auto', posted today) tells us whether a slot is currently open. Volume
// here is a handful of vehicles a month, so pulling today's auto-posted
// rows and filtering in memory is simpler than a timezone-aware SQL date
// truncation, and plenty fast at this scale.
export async function getDueAutoPostJob(): Promise<DueResult> {
  const [settingsRow] = await db.select().from(schema.settings).limit(1);
  if (!settingsRow?.autoPostEnabled) return { due: false, reason: "disabled" };

  const timezone = settingsRow.timezone || "America/Chicago";
  const now = new Date();
  const nowClock = clockTimeInTimezone(timezone, now);
  const today = todayInTimezone(timezone);

  const slotsOpenByNow = (settingsRow.autoPostTimes ?? []).filter((t) => t <= nowClock).length;
  if (slotsOpenByNow === 0) return { due: false, reason: "not_time_yet" };

  const autoPostedToday = await db
    .select({ postedAt: schema.marketingPosts.postedAt })
    .from(schema.marketingPosts)
    .where(and(eq(schema.marketingPosts.postedVia, "auto"), isNotNull(schema.marketingPosts.postedAt)));
  const postedTodayCount = autoPostedToday.filter((p) => dateInTimezone(timezone, p.postedAt!) === today).length;

  if (postedTodayCount >= settingsRow.autoPostMaxPerDay) return { due: false, reason: "max_reached" };
  if (postedTodayCount >= slotsOpenByNow) return { due: false, reason: "not_time_yet" };

  const [nextPost] = await db
    .select()
    .from(schema.marketingPosts)
    .where(and(eq(schema.marketingPosts.queuedForAutoPost, true), isNull(schema.marketingPosts.postedAt)))
    .orderBy(asc(schema.marketingPosts.queuedAt))
    .limit(1);
  if (!nextPost || !nextPost.body) return { due: false, reason: "nothing_queued" };

  const [vehicle] = await db.select().from(schema.vehicles).where(eq(schema.vehicles.id, nextPost.vehicleId)).limit(1);
  if (!vehicle) return { due: false, reason: "nothing_queued" };

  const photos = await db
    .select()
    .from(schema.vehiclePhotos)
    .where(eq(schema.vehiclePhotos.vehicleId, vehicle.id))
    .orderBy(asc(schema.vehiclePhotos.sortOrder));

  const base = getAppBaseUrl();
  const photoUrls = photos.map((p) => `${base}/api/vehicle-photos/${p.id}/file${p.editedStoragePath ? "?v=edited" : ""}`);

  return {
    due: true,
    job: {
      postId: nextPost.id,
      vehicle: {
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim,
        color: vehicle.color,
        miles: vehicle.miles,
        askingPrice: vehicle.askingPrice,
        stockNumber: vehicle.stockNumber,
        vin: vehicle.vin,
        bodyType: vehicle.bodyType,
        fuelType: vehicle.fuelType,
      },
      body: nextPost.body,
      photoUrls,
    },
  };
}
