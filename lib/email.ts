import "server-only";

// Email delivery for the daily desk brief (lib/desk-brief.ts) and any
// future email-based automation — plain fetch() against Resend's REST
// API, same "no SDK, small surface, honest failure" pattern as
// lib/whatsapp.ts's Twilio client. Resend was picked over SMTP/nodemailer
// because it needs zero server-side mail config (no ports to open, no
// deliverability tuning) — just an API key and a verified sending domain.
//
// Needs two env vars, same "check and fail honestly" pattern as
// ANTHROPIC_API_KEY in lib/extraction.ts:
//   RESEND_API_KEY     — from resend.com after creating an account
//   RESEND_FROM_EMAIL  — a "from" address on a domain you've verified with
//                         Resend (their onboarding walks through DNS records)

export function emailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export interface SendEmailResult {
  ok: boolean;
  error?: string;
}

export async function sendEmail(to: string, subject: string, text: string): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return { ok: false, error: "Email isn't connected yet — add RESEND_API_KEY and RESEND_FROM_EMAIL to .env.local." };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return { ok: false, error: data?.message ?? `Resend returned ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
