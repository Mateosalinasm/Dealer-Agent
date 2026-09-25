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

  const result = await getDueAutoPostJob();
  return NextResponse.json(result);
}
