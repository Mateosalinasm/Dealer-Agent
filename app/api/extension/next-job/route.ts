import { NextRequest, NextResponse } from "next/server";
import { bearerTokenFrom, verifyExtensionToken } from "@/lib/extension-auth";
import { getDueAutoPostJob } from "@/lib/auto-post-schedule";

export const dynamic = "force-dynamic";

// Polled by the browser extension (chrome.alarms, every ~15-30 min) — asks
// "is anything due to post right now." Returns at most one job; the
// extension asks again after it finishes (or on its next poll) rather
// than being handed a batch, so a crashed/closed browser never leaves a
// half-posted batch behind.
export async function GET(req: NextRequest) {
  const token = await verifyExtensionToken(bearerTokenFrom(req));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ?force=1 is the popup's "Test now" button — skips the enabled/
  // schedule/max-per-day gates so the operator can iterate on the content
  // script without waiting on real scheduling (still requires something
  // actually queued — this can't invent a job).
  const force = req.nextUrl.searchParams.get("force") === "1";
  const result = await getDueAutoPostJob({ force });
  // The exact same photo URLs kept showing up in testing across several
  // new deployments, which pointed to this response being cached
  // somewhere between the extension and this route (this endpoint's
  // whole point is to say what's due *right now* — a cached answer from
  // even a minute ago can be wrong) — force-dynamic controls Next's own
  // render cache, not the Cache-Control header actually sent to the
  // client, so it's set explicitly here too.
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
