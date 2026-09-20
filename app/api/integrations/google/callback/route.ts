import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleCode } from "@/lib/google-calendar";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/settings?google=denied`, req.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL(`/settings?google=error`, req.url));
  }

  const result = await exchangeGoogleCode(code);
  const status = result.ok ? "connected" : "error";
  return NextResponse.redirect(new URL(`/settings?google=${status}`, req.url));
}
