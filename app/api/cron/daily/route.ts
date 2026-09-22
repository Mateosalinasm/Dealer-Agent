import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { buildDeskBrief } from "@/lib/desk-brief";
import { runPostSaleCheckins } from "@/lib/post-sale-checkins";
import { sendWhatsAppMessage, whatsappConfigured } from "@/lib/whatsapp";
import { sendEmail, emailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

// One daily Vercel Cron job (see vercel.json) instead of two, to stay
// within Hobby-plan cron limits — does the desk brief send and the
// post-sale check-in sweep back to back. Each piece is independent and
// best-effort; one failing (e.g. WhatsApp not configured yet) never blocks
// the other.
//
// Guarded by CRON_SECRET so this can't be triggered by anyone who finds
// the URL — Vercel Cron sends this automatically once the env var is set
// (Vercel docs: "Securing cron jobs"); set it in .env.local too if you
// want to hit this route manually while testing.
export async function GET(req: NextRequest) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const [settingsRow] = await db.select().from(schema.settings).limit(1);

  const briefResult = { sentWhatsApp: false, sentEmail: false, whatsappError: null as string | null, emailError: null as string | null };
  const brief = await buildDeskBrief();

  if (settingsRow?.operatorPhone) {
    if (!whatsappConfigured()) {
      briefResult.whatsappError = "WhatsApp not configured";
    } else {
      const r = await sendWhatsAppMessage(settingsRow.operatorPhone, brief.text);
      briefResult.sentWhatsApp = r.ok;
      if (!r.ok) briefResult.whatsappError = r.error ?? "Unknown error";
    }
  }

  if (settingsRow?.operatorEmail) {
    if (!emailConfigured()) {
      briefResult.emailError = "Email not configured";
    } else {
      const r = await sendEmail(settingsRow.operatorEmail, `Desk brief — ${brief.dateLabel}`, brief.text);
      briefResult.sentEmail = r.ok;
      if (!r.ok) briefResult.emailError = r.error ?? "Unknown error";
    }
  }

  const checkins = await runPostSaleCheckins();

  return NextResponse.json({ brief: briefResult, checkins });
}
