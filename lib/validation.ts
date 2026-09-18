import { z } from "zod";

// Query-string params on GET /api/inventory/search — every field arrives as
// a string, coerce/validate here rather than trusting the caller.
export const inventorySearchParamsSchema = z.object({
  make: z.string().trim().optional(),
  model: z.string().trim().optional(),
  minYear: z.coerce.number().int().min(1900).max(2100).optional(),
  maxYear: z.coerce.number().int().min(1900).max(2100).optional(),
  maxPriceDollars: z.coerce.number().min(0).optional(),
  maxMiles: z.coerce.number().int().min(0).optional(),
  inStockOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const newDealSchema = z.object({
  customerName: z.string().trim().min(1, "Customer name is required"),
  vehicleId: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().optional(),
});

export const dealInfoSchema = z.object({
  lenderId: z.string().uuid().optional().or(z.literal("")),
  programId: z.string().uuid().optional().or(z.literal("")),
  salePriceDollars: z.coerce.number().min(0).optional(),
  cashDownDollars: z.coerce.number().min(0).optional(),
  termMonths: z.coerce.number().int().min(0).optional(),
  aprPct: z.coerce.number().min(0).max(60).optional(),
  backEndGrossDollars: z.coerce.number().optional(),
  notes: z.string().optional(),
});

export const appointmentSchema = z.object({
  customerName: z.string().trim().min(1, "Customer name is required"),
  phone: z.string().optional(),
  scheduledAt: z.string().min(1, "Date and time are required"),
  notes: z.string().optional(),
  dealId: z.string().uuid().optional().or(z.literal("")),
});

export const documentUploadSchema = z.object({
  category: z.enum(["turbopass", "bank_statement", "credit_report", "credit_app", "insurance", "other"]),
});

// Shared across schemas: form/CSV values arrive as strings (possibly
// empty) — coerce/validate here rather than trusting the client.
export const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);
const optionalInt = z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional());
const optionalPct = z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(100).optional());

export const lenderSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  contact: z.string().optional(),
  notes: z.string().optional(),
});

export const titleStatusValues = ["clean", "salvage", "rebuilt", "flood", "lemon", "branded"] as const;

export const programSchema = z.object({
  label: z.string().trim().min(1, "Program name is required"),
  advancePct: z.coerce.number().int().min(0).max(200),
  maxLtvPct: optionalInt,
  maxTermMonths: optionalInt,
  maxMiles: optionalInt,
  maxAgeYears: optionalInt,
  acquisitionFeeDollars: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
  minCreditScore: optionalInt,
  maxPtiPct: optionalPct,
  typicalAprPct: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(60).optional()),
  allowedTitles: z.array(z.enum(titleStatusValues)).optional(),
  notes: z.string().optional(),
});

export const vehicleImportRowSchema = z.object({
  stockNumber: z.string().optional(),
  vin: z.string().optional(),
  year: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1900).max(2100).optional()),
  make: z.string().optional(),
  model: z.string().optional(),
  trim: z.string().optional(),
  color: z.string().optional(),
  miles: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
  askingPriceDollars: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
  acquiredOn: z.string().optional(),
});
export type VehicleImportRow = z.infer<typeof vehicleImportRowSchema>;
export type VehicleImportRowInput = Record<keyof VehicleImportRow, string>;

export const leadStatusValues = ["open", "contacted", "appointment", "sold", "lost"] as const;

export const leadSourceValues = [
  "Walk-in",
  "Phone",
  "Facebook Marketplace",
  "Facebook post",
  "Instagram",
  "Referral",
  "Website",
  "Other",
] as const;

export const leadSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  phone: z.string().optional(),
  source: z.string().optional(),
  wants: z.string().optional(),
  wantMake: z.string().optional(),
  wantModel: z.string().optional(),
  maxMiles: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
  maxPaymentDollars: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
  downAvailableDollars: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
});
