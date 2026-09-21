import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { sendAndLogAgentMessage } from "@/lib/messaging";
import { appendLog } from "@/lib/deal-stage";
import { getDealershipTimezone, todayInTimezone } from "@/lib/dealership-time";

const MILESTONES = ["30", "60", "90"] as const;
type Milestone = (typeof MILESTONES)[number];

function daysAgo(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function messageFor(milestone: Milestone, customerName: string | null, googleReviewUrl: string | null): string {
  const name = customerName ? customerName.split(" ")[0] : "there";
  switch (milestone) {
    case "30":
      return `Hi ${name}, it's been about a month since you picked up your vehicle with us — just checking in. Everything running well? Let us know if you need anything.`;
    case "60":
      return `Hi ${name}, hope your vehicle's been treating you well these past couple months. If anything's come up — a question, a service need — reach out anytime.`;
    case "90":
      return googleReviewUrl
        ? `Hi ${name}, it's been 90 days since your purchase — hope it's been a great fit. If you have a minute, a review would mean a lot to us: ${googleReviewUrl}`
        : `Hi ${name}, it's been 90 days since your purchase — hope it's been a great fit. Thanks again for your business!`;
  }
}

export interface PostSaleCheckinsResult {
  checked: number;
  sent: { dealId: string; milestone: Milestone; ok: boolean }[];
}

/**
 * Finds every funded, non-archived deal whose fundedOn date lands exactly
 * on a 30/60/90-day boundary (as of "today" in the dealership's own
 * timezone — see lib/dealership-time.ts) and hasn't already gotten that
 * milestone's message (deals.checkinsSent), and sends it. Meant to run
 * once a day (app/api/cron/daily/route.ts) — checkinsSent is what makes a
 * second run on the same day, or a Vercel Cron retry, a no-op instead of
 * a duplicate text.
 */
export async function runPostSaleCheckins(): Promise<PostSaleCheckinsResult> {
  const timezone = await getDealershipTimezone();
  const today = todayInTimezone(timezone);

  const [settingsRow] = await db.select().from(schema.settings).limit(1);
  const googleReviewUrl = settingsRow?.googleReviewUrl ?? null;

  const fundedDeals = await db.select().from(schema.deals).where(eq(schema.deals.funded, true));

  const sent: PostSaleCheckinsResult["sent"] = [];
  let checked = 0;

  for (const deal of fundedDeals) {
    if (deal.archived || !deal.fundedOn) continue;
    const phone = normalizePhone(deal.phone);
    if (!phone) continue;

    for (const milestone of MILESTONES) {
      if (deal.checkinsSent.includes(milestone)) continue;
      const targetDate = daysAgo(today, Number(milestone));
      if (deal.fundedOn !== targetDate) continue;

      checked++;
      const body = messageFor(milestone, deal.customerName, googleReviewUrl);
      const result = await sendAndLogAgentMessage(phone, body, { name: deal.customerName, dealId: deal.id });

      const log = appendLog(deal.log, result.ok ? `Sent ${milestone}-day check-in.` : `${milestone}-day check-in failed: ${result.error}`);
      const checkinsSent = result.ok ? [...deal.checkinsSent, milestone] : deal.checkinsSent;
      await db.update(schema.deals).set({ log, checkinsSent }).where(eq(schema.deals.id, deal.id));

      sent.push({ dealId: deal.id, milestone, ok: result.ok });
    }
  }

  return { checked, sent };
}
