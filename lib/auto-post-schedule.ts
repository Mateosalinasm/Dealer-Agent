import "server-only";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { clockTimeInTimezone, dateInTimezone, todayInTimezone } from "@/lib/dealership-time";
import { getAppBaseUrl } from "@/lib/app-url";
import { downPaymentCentsFor, extractDownPaymentCentsFromBody } from "@/lib/marketing-copy";

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
    // What Facebook's Price field should actually show — the "starting
    // from" down payment. Read from the listing body's own text first
    // (whatever figure is actually printed in the ad — a body can be
    // manually edited, or written before a tier-rule change, and drift
    // from what downPaymentCentsFor() computes today; the Price field
    // must always match what the ad itself says, never a different
    // number), falling back to the deterministic tier rule only if the
    // body has no dollar figure to read. Null only if bodyType somehow
    // isn't set AND parsing failed, in which case the content script
    // falls back to askingPrice rather than posting a blank price.
    downPaymentCents: number | null;
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
//
// `force` is the popup's "Test now" button — it skips the
// enabled/schedule/max-per-day gates entirely (there's still nothing to
// send if nothing_queued — force can't invent a job out of thin air), for
// iterating on the content script without waiting on real scheduling.
export async function getDueAutoPostJob(opts?: { force?: boolean }): Promise<DueResult> {
  const force = opts?.force ?? false;
  const [settingsRow] = await db.select().from(schema.settings).limit(1);
  if (!force && !settingsRow?.autoPostEnabled) return { due: false, reason: "disabled" };

  const timezone = settingsRow?.timezone || "America/Chicago";

  if (!force) {
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
  }

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
        downPaymentCents: extractDownPaymentCentsFromBody(nextPost.body) ?? downPaymentCentsFor(vehicle),
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
