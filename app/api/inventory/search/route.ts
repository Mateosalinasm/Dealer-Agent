import { NextRequest, NextResponse } from "next/server";
import { searchInventory } from "@/lib/inventory-api";
import { inventorySearchParamsSchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const raw = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = inventorySearchParamsSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query params", issues: parsed.error.issues }, { status: 400 });
  }

  const results = await searchInventory(parsed.data);
  return NextResponse.json({ results });
}
