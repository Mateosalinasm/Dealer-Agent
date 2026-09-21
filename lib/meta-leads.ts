import "server-only";
import crypto from "node:crypto";
import { db, schema } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";

// Meta (Facebook/Instagram) Lead Ads — same "check and fail honestly"
// pattern as every other integration in this app. Needs three env vars:
//   META_APP_SECRET            — from the Meta app's Settings > Basic
//   META_PAGE_ACCESS_TOKEN     — a page access token with leads_retrieval
//                                 permission (Graph API Explorer, or your
//                                 app's own token-generation flow)
//   META_WEBHOOK_VERIFY_TOKEN  — any string you make up; Meta echoes it
//                                 back during the webhook handshake so you
//                                 can confirm the subscribe request is
//                                 really you setting it up
//
// Setup (do this after the env vars are set and deployed):
// 1. developers.facebook.com > your app > Webhooks > Page > Subscribe,
//    callback URL https://<your domain>/api/leads/meta/webhook,
//    verify token = META_WEBHOOK_VERIFY_TOKEN, subscribe to "leadgen".
// 2. Your Facebook Page > Settings > you may need "Lead Ads" app access.
//
// The webhook payload only carries a leadgen_id, not the actual answers —
// this fetches the real name/phone/email from the Graph API right after,
// same two-step flow Meta's own docs describe.

const GRAPH_API_VERSION = "v21.0";

export function metaLeadsConfigured(): boolean {
  return !!(process.env.META_APP_SECRET && process.env.META_PAGE_ACCESS_TOKEN && process.env.META_WEBHOOK_VERIFY_TOKEN);
}

/** Meta signs the raw webhook body with the app secret: `sha256=<hex hmac>`. Never skip this — this route is public the moment it's configured. */
export function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !signatureHeader) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody, "utf-8").digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false; // length mismatch etc. — treat as not verified
  }
}

interface LeadFieldData {
  name: string;
  values: string[];
}

function pick(fields: LeadFieldData[], ...names: string[]): string | null {
  for (const n of names) {
    const f = fields.find((f) => f.name.toLowerCase() === n);
    if (f?.values?.[0]) return f.values[0];
  }
  return null;
}

/**
 * Fetches the real answers for one lead from the Graph API and writes a
 * `leads` row. Dedup via leads.externalId (unique index) — a webhook
 * retry (Meta resends on anything but a 200) becomes a no-op instead of a
 * duplicate lead, via onConflictDoNothing rather than a racy select-then-insert.
 */
export async function upsertLeadFromMeta(leadgenId: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) return { ok: false, error: "META_PAGE_ACCESS_TOKEN not set" };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(leadgenId)}?access_token=${encodeURIComponent(token)}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Graph API returned ${res.status}: ${body.slice(0, 300)}` };
    }
    const data = await res.json();
    const fields: LeadFieldData[] = data.field_data ?? [];

    const combinedName = [pick(fields, "first_name"), pick(fields, "last_name")].filter(Boolean).join(" ");
    const fullName = pick(fields, "full_name") ?? (combinedName || "Facebook/Instagram lead");
    const phone = normalizePhone(pick(fields, "phone_number"));
    const email = pick(fields, "email");

    await db
      .insert(schema.leads)
      .values({
        name: fullName,
        phone,
        email,
        source: "Facebook/Instagram Lead Ads",
        status: "open",
        externalId: `meta:${leadgenId}`,
      })
      .onConflictDoNothing({ target: schema.leads.externalId });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
