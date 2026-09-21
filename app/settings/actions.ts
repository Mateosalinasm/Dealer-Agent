"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { disconnectIntegration } from "@/lib/integrations";
import { normalizePhone } from "@/lib/phone";
import { buildDeskBrief } from "@/lib/desk-brief";
import { sendWhatsAppMessage, whatsappConfigured } from "@/lib/whatsapp";
import { sendEmail, emailConfigured } from "@/lib/email";

export async function disconnectGoogleCalendar() {
  await disconnectIntegration("google_calendar");
  revalidatePath("/settings");
}

// Same single-row upsert pattern as updatePricingAssumptions
// (app/sourcing/watch-list/actions.ts) and setDealershipTimezone
// (app/sourcing/auction-day/actions.ts).
export async function updateNotificationSettings(formData: FormData) {
  const operatorPhone = normalizePhone(String(formData.get("operatorPhone") ?? ""));
  const operatorEmail = String(formData.get("operatorEmail") ?? "").trim() || null;
  const googleReviewUrl = String(formData.get("googleReviewUrl") ?? "").trim() || null;

  const [existing] = await db.select().from(schema.settings).limit(1);
  if (existing) {
    await db.update(schema.settings).set({ operatorPhone, operatorEmail, googleReviewUrl }).where(eq(schema.settings.id, existing.id));
  } else {
    await db.insert(schema.settings).values({ operatorPhone, operatorEmail, googleReviewUrl });
  }
  revalidatePath("/settings");
}

export interface TestBriefResult {
  sentWhatsApp: boolean;
  sentEmail: boolean;
  whatsappError: string | null;
  emailError: string | null;
  neitherConfigured: boolean;
}

/** Sends today's real desk brief right now — the same content the cron job would send, useful to confirm setup without waiting for the schedule. */
export async function sendTestDeskBrief(): Promise<TestBriefResult> {
  const [settingsRow] = await db.select().from(schema.settings).limit(1);
  const result: TestBriefResult = { sentWhatsApp: false, sentEmail: false, whatsappError: null, emailError: null, neitherConfigured: false };

  if (!settingsRow?.operatorPhone && !settingsRow?.operatorEmail) {
    result.neitherConfigured = true;
    return result;
  }

  const brief = await buildDeskBrief();

  if (settingsRow.operatorPhone) {
    if (!whatsappConfigured()) {
      result.whatsappError = "WhatsApp isn't connected yet.";
    } else {
      const r = await sendWhatsAppMessage(settingsRow.operatorPhone, brief.text);
      result.sentWhatsApp = r.ok;
      if (!r.ok) result.whatsappError = r.error ?? "Unknown error";
    }
  }

  if (settingsRow.operatorEmail) {
    if (!emailConfigured()) {
      result.emailError = "Email isn't connected yet.";
    } else {
      const r = await sendEmail(settingsRow.operatorEmail, `Desk brief — ${brief.dateLabel}`, brief.text);
      result.sentEmail = r.ok;
      if (!r.ok) result.emailError = r.error ?? "Unknown error";
    }
  }

  return result;
}
