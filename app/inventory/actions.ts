"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { getDealershipTimezone, todayInTimezone } from "@/lib/dealership-time";
import { vehicleImportRowSchema, type VehicleImportRowInput } from "@/lib/validation";

export async function importVehicles(rows: VehicleImportRowInput[]) {
  if (rows.length === 0) return { imported: 0, errors: [] as string[] };

  const today = todayInTimezone(await getDealershipTimezone());
  const errors: string[] = [];
  const values: (typeof schema.vehicles.$inferInsert)[] = [];

  rows.forEach((raw, idx) => {
    const parsed = vehicleImportRowSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push(`Row ${idx + 1}: ${parsed.error.issues.map((e) => e.message).join(", ")}`);
      return;
    }
    const row = parsed.data;
    values.push({
      stockNumber: row.stockNumber || null,
      vin: row.vin || null,
      year: row.year ?? null,
      make: row.make || null,
      model: row.model || null,
      trim: row.trim || null,
      color: row.color || null,
      miles: row.miles ?? null,
      askingPrice: row.askingPriceDollars != null ? Math.round(row.askingPriceDollars * 100) : null,
      acquiredOn: row.acquiredOn || today,
      title: "clean",
    });
  });

  if (values.length > 0) {
    await db.insert(schema.vehicles).values(values);
    revalidatePath("/inventory");
    revalidatePath("/desk/deals/new");
  }

  return { imported: values.length, errors };
}

export async function markVehicleSold(vehicleId: string, sold: boolean) {
  const soldOn = sold ? todayInTimezone(await getDealershipTimezone()) : null;
  await db.update(schema.vehicles).set({ sold, soldOn }).where(eq(schema.vehicles.id, vehicleId));
  revalidatePath("/inventory");
  revalidatePath("/sourcing/what-to-buy");
  revalidatePath("/sourcing/buy-scorecard");
}
