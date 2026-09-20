import { NextRequest, NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/google-calendar";

export async function GET(req: NextRequest) {
  const url = getGoogleAuthUrl();
  if (!url) {
    return NextResponse.redirect(new URL("/settings?google=not_configured", req.url));
  }
  return NextResponse.redirect(url);
}
