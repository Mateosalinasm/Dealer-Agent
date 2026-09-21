import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyMetaSignature, upsertLeadFromMeta } from "@/lib/meta-leads";

// Meta's webhook verification handshake — sent once, when you click
// "Verify and save" in the Meta developer console while subscribing this
// URL. Echoes hub.challenge back as plain text if the verify token matches.
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.META_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

// The actual lead notifications. Meta POSTs one of these per new lead
// (and resends on anything but a 200, so upsertLeadFromMeta's dedup via
// leads.externalId matters). Reject anything not provably from Meta
// before touching the database — same discipline as the Twilio webhook.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  if (!verifyMetaSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  let payload: { entry?: { changes?: { field?: string; value?: { leadgen_id?: string } }[] }[] };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const leadgenIds = (payload.entry ?? [])
    .flatMap((entry) => entry.changes ?? [])
    .filter((change) => change.field === "leadgen")
    .map((change) => change.value?.leadgen_id)
    .filter((id): id is string => !!id);

  for (const leadgenId of leadgenIds) {
    // Best-effort per lead — one bad Graph API call shouldn't drop the rest
    // of the batch or make Meta think the whole delivery failed.
    await upsertLeadFromMeta(leadgenId);
  }

  if (leadgenIds.length > 0) revalidatePath("/leads");

  return NextResponse.json({ received: leadgenIds.length });
}
