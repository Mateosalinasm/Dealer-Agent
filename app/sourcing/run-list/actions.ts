"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { emptyToUndefined } from "@/lib/validation";

const addToWatchListSchema = z.object({
  house: z.enum(["manheim", "americas", "iaa"]),
  runNumber: z.string().optional(),
  year: z.preprocess(emptyToUndefined, z.coerce.number().int().optional()),
  make: z.string().trim().min(1),
  model: z.string().trim().min(1),
  trim: z.string().optional(),
  miles: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
  vin: z.string().optional(),
  title: z.enum(["clean", "salvage", "rebuilt", "flood", "lemon", "branded"]),
  retailDollars: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
  wholesaleDollars: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
  reconDollars: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
  announcements: z.string().optional(),
});

export async function addToWatchList(input: z.input<typeof addToWatchListSchema>) {
  const p = addToWatchListSchema.parse(input);
  await db.insert(schema.watchItems).values({
    house: p.house,
    runNumber: p.runNumber || null,
    year: p.year ?? null,
    make: p.make,
    model: p.model,
    trim: p.trim || null,
    miles: p.miles ?? null,
    vin: p.vin || null,
    title: p.title,
    retail: p.retailDollars != null ? Math.round(p.retailDollars * 100) : null,
    wholesale: p.wholesaleDollars != null ? Math.round(p.wholesaleDollars * 100) : null,
    reconEstimate: p.reconDollars != null ? Math.round(p.reconDollars * 100) : 0,
    announcements: p.announcements || null,
  });
  revalidatePath("/sourcing/watch-list");
}
