import { z } from "zod";
import { buyerApplicationSchema } from "@/lib/buyer-application";

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

export const newDealSchema = z
  .object({
    customerName: z.string().trim().min(1, "Customer name is required"),
    phone: z.string().optional(),
    vehicleId: z.string().uuid().optional().or(z.literal("")),
    wantBodyType: z.enum(["truck", "sedan", "suv"]).optional().or(z.literal("")),
    lenderId: z.string().uuid().optional().or(z.literal("")),
    dealDate: z.string().optional(),
    lot: z.string().optional(),
    notes: z.string().optional(),
    idType: z.string().optional(),
    cashDownDollars: z.coerce.number().min(0).optional(),
    statedIncomeDollars: z.coerce.number().min(0).optional(),
  })
  .extend(buyerApplicationSchema.shape);

export const dealInfoSchema = z.object({
  programId: z.string().uuid().optional().or(z.literal("")),
  termMonths: z.coerce.number().int().min(0).optional(),
  aprPct: z.coerce.number().min(0).max(60).optional(),
  commissionDollars: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});

export const moneyTradeSchema = z.object({
  salePriceDollars: z.coerce.number().min(0).optional(),
  docFeeDollars: z.coerce.number().min(0).optional(),
  salesTaxDollars: z.coerce.number().min(0).optional(),
  warrantyDollars: z.coerce.number().min(0).optional(),
  gapInsDollars: z.coerce.number().min(0).optional(),
  backEndCostDollars: z.coerce.number().min(0).optional(),
  tradeVehicle: z.string().optional(),
  tradeAcvDollars: z.coerce.number().optional(),
  tradePayoffDollars: z.coerce.number().min(0).optional(),
});

export const customerFactsSchema = z
  .object({
    vehicleId: z.string().uuid().optional().or(z.literal("")),
    wantBodyType: z.enum(["truck", "sedan", "suv"]).optional().or(z.literal("")),
    lenderId: z.string().uuid().optional().or(z.literal("")),
    phone: z.string().optional(),
    firstPaymentDate: z.string().optional(),
    lot: z.string().optional(),
    cashDownDollars: z.coerce.number().min(0).optional(),
    statedIncomeDollars: z.coerce.number().min(0).optional(),
    verifiedIncomeDollars: z.coerce.number().min(0).optional(),
    paymentDollars: z.coerce.number().min(0).optional(),
    openAutoPaymentDollars: z.coerce.number().min(0).optional(),
    statedAddress: z.string().optional(),
    idType: z.string().optional(),
  })
  .extend(buyerApplicationSchema.shape);

export const creditSchema = z.object({
  fico: z.coerce.number().int().min(300).max(900).optional(),
  idType: z.string().optional(),
  inquiries30d: z.coerce.number().int().min(0).optional(),
  repossessions: z.coerce.number().int().min(0).optional(),
  collectionsDollars: z.coerce.number().min(0).optional(),
  openAutos: z.coerce.number().int().min(0).optional(),
  autoLates: z.coerce.number().int().min(0).optional(),
  bankruptcies: z.coerce.number().int().min(0).optional(),
  mortgages: z.coerce.number().int().min(0).optional(),
});

export const submissionSchema = z.object({
  status: z.enum(["sent", "approved", "counter", "declined", "pulled"]),
  aprPct: z.coerce.number().min(0).max(60).optional(),
  term: z.coerce.number().int().min(0).optional(),
  advanceDollars: z.coerce.number().min(0).optional(),
  maxPaymentDollars: z.coerce.number().min(0).optional(),
  tier: z.string().optional(),
  downReqDollars: z.coerce.number().min(0).optional(),
  stips: z.string().optional(),
  reason: z.string().optional(),
});

export const ptiSchema = z.object({
  ptiPriceDollars: z.coerce.number().min(0).optional(),
  ptiPct: z.coerce.number().int().min(0).max(100).optional(),
});

export const appointmentSchema = z.object({
  customerName: z.string().trim().min(1, "Customer name is required"),
  phone: z.string().optional(),
  scheduledAt: z.string().min(1, "Date and time are required"),
  notes: z.string().optional(),
  dealId: z.string().uuid().optional().or(z.literal("")),
  vehicleId: z.string().uuid().optional().or(z.literal("")),
  vehicleBodyType: z.enum(["truck", "sedan", "suv"]).optional().or(z.literal("")),
});

export const documentUploadSchema = z.object({
  category: z.enum(["turbopass", "bank_statement", "credit_report", "credit_app", "insurance", "autocheck", "lender_guidelines", "other"]),
});

// Shared across schemas: form/CSV values arrive as strings (possibly
// empty) — coerce/validate here rather than trusting the client.
export const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);
const optionalInt = z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional());
const optionalPct = z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(100).optional());

export const lenderSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  contact: z.string().optional(),
  repPhone: z.string().optional(),
  address: z.string().optional(),
  maxDeductibleDollars: z.coerce.number().min(0).default(1000),
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

export const warrantyProductTypeValues = ["vsc", "gap", "tire_wheel", "key_replacement", "maintenance", "other"] as const;

export const warrantyProductSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  provider: z.string().trim().min(1, "Provider is required"),
  productType: z.enum(warrantyProductTypeValues),
  costDollars: z.coerce.number().min(0),
  priceDollars: z.coerce.number().min(0),
  termMonths: optionalInt,
  termMiles: optionalInt,
  deductibleDollars: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
  maxVehicleAgeYears: optionalInt,
  maxVehicleMiles: optionalInt,
  minSalePriceDollars: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
  maxSalePriceDollars: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
  notes: z.string().optional(),
});

export const fuelTypeValues = ["gas", "diesel", "hybrid", "electric"] as const;

export const manualVehicleSchema = z.object({
  stockNumber: z.string().optional(),
  vin: z.string().optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  trim: z.string().optional(),
  color: z.string().optional(),
  bodyType: z.enum(["truck", "sedan", "suv"]).optional().or(z.literal("")),
  title: z.enum(titleStatusValues),
  miles: z.coerce.number().int().min(0).optional(),
  priceDollars: z.coerce.number().min(0).optional(),
  costDollars: z.coerce.number().min(0).optional(),
  lot: z.string().optional(),
  daysOnLot: z.coerce.number().int().min(0).default(0),
  autocheckDocumentId: z.string().uuid().optional().or(z.literal("")),
  // Feed lib/marketing-copy.ts's down-payment tiers — see that file for why
  // these are set explicitly here rather than inferred from trim/model text.
  fuelType: z.enum(fuelTypeValues).default("gas"),
  isThreeRowSuv: z.coerce.boolean().default(false),
});

// Editing an existing vehicle — same identity/spec fields as
// manualVehicleSchema, but the acquisition side is different: an existing
// row already has a real acquiredOn date, so this edits that directly
// instead of re-deriving it from "days on lot" (which only makes sense
// once, at intake). Cost is a single all-in figure, same as the Add form's
// "cost" field — see updateVehicle in app/inventory/actions.ts for how it's
// written (it also zeroes the legacy buyFee/tow/recon columns so nothing
// stale adds on top of it).
export const editVehicleSchema = z.object({
  stockNumber: z.string().optional(),
  vin: z.string().optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  trim: z.string().optional(),
  color: z.string().optional(),
  bodyType: z.enum(["truck", "sedan", "suv"]).optional().or(z.literal("")),
  title: z.enum(titleStatusValues),
  miles: z.coerce.number().int().min(0).optional(),
  priceDollars: z.coerce.number().min(0).optional(),
  costDollars: z.coerce.number().min(0).optional(),
  lot: z.string().optional(),
  acquiredOn: z.string().optional().or(z.literal("")),
  fuelType: z.enum(fuelTypeValues).default("gas"),
  isThreeRowSuv: z.coerce.boolean().default(false),
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
  bodyType: z.preprocess(emptyToUndefined, z.enum(["truck", "sedan", "suv"]).optional()),
  miles: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
  askingPriceDollars: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
  costDollars: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
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

// Posted by the browser extension after it attempts a Facebook Marketplace
// listing — see app/api/extension/report/route.ts.
export const autoPostReportSchema = z.object({
  postId: z.string().uuid(),
  ok: z.boolean(),
  error: z.string().max(2000).optional(),
  listingUrl: z.string().url().optional(),
});

// The Settings page's auto-post schedule form.
export const autoPostScheduleSchema = z.object({
  autoPostEnabled: z.boolean(),
  // Raised from 10 to 20 temporarily for live testing — drop back to 10
  // (or whatever's actually safe) once testing is done.
  autoPostMaxPerDay: z.coerce.number().int().min(1).max(20),
  // "HH:mm" 24h times, one per line/entry from the form.
  // Also raised 10 → 20 alongside autoPostMaxPerDay above, for the same
  // reason — matches how many distinct times you can actually configure.
  autoPostTimes: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24h HH:mm, e.g. 09:00")).min(1).max(20),
});

// Posted by the Messenger extension (or any future channel adapter) when a
// new customer message comes in — see app/api/marketplace-agent/inbound/route.ts.
// Exactly one of vehicleId/listingUrl must resolve to a real vehicle; both
// are accepted since the extension may only have the listing URL Facebook
// shows in the conversation header, not this app's own vehicle id.
export const marketplaceInboundSchema = z.object({
  externalThreadId: z.string().min(1).max(200),
  vehicleId: z.string().uuid().optional(),
  listingUrl: z.string().url().optional(),
  contactName: z.string().max(200).optional(),
  body: z.string().min(1).max(4000),
});

// Posted by the dashboard (or extension) to approve — optionally editing —
// a Claude-drafted reply before it sends. See
// app/api/marketplace-agent/approve/route.ts.
export const marketplaceApproveSchema = z.object({
  messageId: z.string().uuid(),
  body: z.string().min(1).max(4000).optional(),
});

// Posted by the Messenger extension after it attempts to actually send an
// approved reply — see app/api/marketplace-agent/report/route.ts.
export const marketplaceReportSchema = z.object({
  messageId: z.string().uuid(),
  ok: z.boolean(),
  providerMessageId: z.string().max(200).optional(),
});
