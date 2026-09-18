"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";

// The only delete path against sale_comps. This is a correction tool for a
// bad entry, not a normal flow — see CLAUDE.md: sale_comps is otherwise
// append-only and protected.
export async function deleteSaleComp(compId: string) {
  await db.delete(schema.saleComps).where(eq(schema.saleComps.id, compId));
  revalidatePath("/sourcing/sale-ledger");
}
