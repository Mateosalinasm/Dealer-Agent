import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { sendAndLogAgentMessage } from "@/lib/messaging";
import { appendLog } from "@/lib/deal-stage";

const FIRST_PAYMENT_DAYS_AFTER_FUNDING = 30;

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Runs once, right after a deal flips to funded (see toggleDealStep in
 * app/desk/deals/actions.ts — only called on the false -> true transition,
 * never on every checklist toggle, and never on unfunding). Three things,
 * each best-effort and independently logged to the deal so a missing phone
 * number or a down WhatsApp connection never blocks the funding checklist:
 *
 *   1. Default firstPaymentDate to fundedOn + 30 days, if not already set
 *      (still editable afterward — see Customer facts on the deal page).
 *   2. Match a lead by phone number and flip its status to "sold".
 *   3. Text the customer their first payment date and lienholder.
 */
export async function handleDealFunded(dealId: string, fundedOn: string) {
  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, dealId)).limit(1);
  if (!deal) return;

  let log = deal.log;
  let firstPaymentDate = deal.firstPaymentDate;
  if (!firstPaymentDate) {
    firstPaymentDate = addDays(fundedOn, FIRST_PAYMENT_DAYS_AFTER_FUNDING);
    log = appendLog(log, `First payment date set to ${firstPaymentDate} (funded date + ${FIRST_PAYMENT_DAYS_AFTER_FUNDING} days).`);
  }

  const phone = normalizePhone(deal.phone);

  const leads = await db.select().from(schema.leads);
  const matchedLead = phone ? leads.find((l) => normalizePhone(l.phone) === phone) : undefined;
  if (matchedLead && matchedLead.status !== "sold") {
    await db.update(schema.leads).set({ status: "sold" }).where(eq(schema.leads.id, matchedLead.id));
    log = appendLog(log, `Linked lead "${matchedLead.name}" marked sold.`);
  }

  if (!phone) {
    log = appendLog(log, "Skipped sold WhatsApp message — no phone on file for this deal.");
  } else {
    let lenderName: string | null = null;
    if (deal.lenderId) {
      const [lender] = await db.select().from(schema.lenders).where(eq(schema.lenders.id, deal.lenderId)).limit(1);
      lenderName = lender?.name ?? null;
    }
    const paymentDateLabel = new Date(`${firstPaymentDate}T00:00:00Z`).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const body = lenderName
      ? `Congrats on your new vehicle! Your lender is ${lenderName}, and your first payment is due ${paymentDateLabel}. Reach out anytime with questions.`
      : `Congrats on your new vehicle! Your first payment is due ${paymentDateLabel}. Reach out anytime with questions.`;

    const result = await sendAndLogAgentMessage(phone, body, { name: deal.customerName, dealId: deal.id, leadId: matchedLead?.id ?? null });
    log = appendLog(log, result.ok ? "Sent sold/first-payment WhatsApp message." : `Sold WhatsApp message failed: ${result.error}`);
  }

  await db.update(schema.deals).set({ firstPaymentDate, log }).where(eq(schema.deals.id, dealId));
}

const REFERRAL_BONUS_DOLLARS = 200;

/** Manual send — see components/deal-copilot-modal.tsx's sibling, the "Send referral message" button on a funded deal. */
export async function sendReferralMessage(dealId: string): Promise<{ ok: boolean; error?: string }> {
  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, dealId)).limit(1);
  if (!deal) return { ok: false, error: "Deal not found." };

  const phone = normalizePhone(deal.phone);
  if (!phone) return { ok: false, error: "No phone on file for this deal." };

  const body = `Thanks again for your business! Know someone shopping for a vehicle? Refer them to us and get $${REFERRAL_BONUS_DOLLARS} once they buy. Just have them mention your name.`;
  const result = await sendAndLogAgentMessage(phone, body, { name: deal.customerName, dealId: deal.id });

  const log = appendLog(deal.log, result.ok ? "Sent referral ($200) WhatsApp message." : `Referral WhatsApp message failed: ${result.error}`);
  await db.update(schema.deals).set({ log }).where(eq(schema.deals.id, dealId));

  return result;
}
