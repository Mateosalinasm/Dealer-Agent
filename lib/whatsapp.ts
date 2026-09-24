import "server-only";
import crypto from "node:crypto";

// Twilio's WhatsApp API over plain fetch — no SDK dependency, since this
// can't be exercised without real credentials anyway and the REST surface
// is small (send a message, verify a webhook signature). Swap for the
// `twilio` npm package later if the raw HTTP starts feeling thin.
//
// Needs three env vars, same "check and fail honestly" pattern as
// ANTHROPIC_API_KEY in lib/extraction.ts:
//   TWILIO_ACCOUNT_SID       — starts with "AC..."
//   TWILIO_AUTH_TOKEN        — from the Twilio console
//   TWILIO_WHATSAPP_FROM     — e.g. "whatsapp:+14155238886" (include the "whatsapp:" prefix)
// Get these from console.twilio.com after enabling the WhatsApp sandbox
// (for testing) or a verified WhatsApp Business sender (for production).

export function whatsappConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM);
}

export interface SendResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

// WhatsApp Business (via Twilio) only allows free-form text as a *reply*
// within 24 hours of the customer's last inbound message — that's Meta's
// own anti-spam policy, not something this app controls. Starting a new
// conversation, or messaging someone again after that 24-hour window
// closes, requires a pre-approved Message Template (a "ContentSid" in
// Twilio's terms), which this integration doesn't send yet. Twilio's own
// error for this ("ContentSid Required" / error 63016) is accurate but
// meaningless without that context, so translate it into something
// actionable instead of showing it raw.
function explainTwilioError(data: { message?: string; code?: number }): string {
  const raw = data?.message ?? "";
  if (data?.code === 63016 || /contentsid/i.test(raw)) {
    return "WhatsApp needs an approved message template to start a new conversation or reply after 24 hours of silence — free text only works as a reply within 24 hours of their last message to you. Set up an approved template in the Twilio Console to send outside that window.";
  }
  return raw || "Twilio couldn't send this message.";
}

export async function sendWhatsAppMessage(toE164: string, body: string): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !token || !from) {
    return { ok: false, error: "WhatsApp isn't connected yet — add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_WHATSAPP_FROM to .env.local." };
  }

  const params = new URLSearchParams({
    From: from,
    To: `whatsapp:${toE164}`,
    Body: body,
  });

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: explainTwilioError(data) };
    }
    return { ok: true, providerMessageId: data.sid };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Verifies an inbound webhook actually came from Twilio, per their
 * documented signature scheme: base64(HMAC-SHA1(authToken, url + sorted
 * "key+value" params concatenated)). Never skip this on a public route —
 * an unauthenticated webhook that writes to the messages table is an open
 * door for anyone who finds the URL.
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
export function verifyTwilioSignature(url: string, params: Record<string, string>, signatureHeader: string | null): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !signatureHeader) return false;

  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);

  const expected = crypto.createHmac("sha1", token).update(Buffer.from(data, "utf-8")).digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false; // length mismatch etc. — treat as not verified
  }
}
