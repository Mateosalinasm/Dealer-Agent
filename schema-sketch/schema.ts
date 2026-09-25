import {
  pgTable, uuid, text, integer, boolean, date, timestamp, jsonb, index, uniqueIndex,
} from 'drizzle-orm/pg-core';

// --- Additions beyond the original 8-table handoff, for the Desk features
// (deal creation, document uploads, appointments, inventory import). See
// CLAUDE.md for the note on why these were added. ---

export const documentCategory = [
  'turbopass', 'bank_statement', 'credit_report', 'credit_app', 'insurance', 'autocheck', 'lender_guidelines', 'other',
] as const;

export const extractionStatus = ['none', 'pending', 'success', 'failed'] as const;

export const appointmentStatus = ['scheduled', 'completed', 'canceled'] as const;

export const integrationProvider = ['whatsapp', 'google_calendar'] as const;
export const messageDirection = ['inbound', 'outbound'] as const;
export const messageStatus = ['queued', 'sent', 'delivered', 'read', 'failed'] as const;

export const warrantyProductType = ['vsc', 'gap', 'tire_wheel', 'key_replacement', 'maintenance', 'other'] as const;

// Buyer application detail — mirrors a standard DealerCenter-style credit
// application (Buyer Info / Address / Employment / Other Income). Grouped
// as jsonb per section instead of ~50 flat columns, same pattern already
// used for done/stips/log/subs above. Money fields inside stay integer
// cents like everywhere else in this file.
export interface AddressDetail {
  street: string | null;
  aptUnit: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;
  addressType: string | null; // 'rent' | 'own' | etc, as typed
  rentMortCents: number | null;
  years: number | null;
  months: number | null;
}

// Monthly income (statedIncome, elsewhere on deals) is the figure
// dealHealth/ptiCalc/credit-grade read — grossSalaryCents here is the
// employer's own stated gross salary off the application, a separate
// self-reported figure, not derived from or feeding into statedIncome.
export interface EmploymentDetail {
  employerName: string | null;
  occupation: string | null;
  employerPhone: string | null;
  employmentStatus: string | null;
  incomeType: string | null; // 'turbopass' | 'paystub' | 'self_employed' | etc, as typed
  grossSalaryCents: number | null;
  yearsAtJob: number | null;
  monthsAtJob: number | null;
  street: string | null;
  aptUnit: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;
}

export interface OtherIncomeDetail {
  amountCents: number | null;
  source: string | null;
}

// All money is integer CENTS. No floats anywhere in this file.

export const settings = pgTable('settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  targetGross: integer('target_gross').notNull().default(320000),
  assumedDown: integer('assumed_down').notNull().default(150000),
  holdingCostPerDay: integer('holding_cost_per_day').notNull().default(1200),
  laneBudget: integer('lane_budget'),
  // IANA name (e.g. "America/Chicago"). Every "today" boundary in Sourcing
  // (auction-day budget, sale_comps.observedOn, vehicles.acquiredOn) is
  // computed against this, not server UTC — the server may run anywhere
  // (Vercel), but the auction lane doesn't. Null falls back to a default;
  // see lib/dealership-time.ts.
  timezone: text('timezone'),
  // Where the daily desk brief (lib/desk-brief.ts) and post-sale check-ins
  // go — the operator's own number/inbox, not a customer's. Either can be
  // left blank to skip that channel; the cron route just sends to whichever
  // is set.
  operatorPhone: text('operator_phone'),
  operatorEmail: text('operator_email'),
  // Included in the 90-day post-sale check-in message when set — left blank
  // otherwise rather than sending a generic "leave us a review" with
  // nowhere to click.
  googleReviewUrl: text('google_review_url'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auctionHouse = ['manheim', 'americas', 'iaa'] as const;
export const titleStatus = ['clean', 'salvage', 'rebuilt', 'flood', 'lemon', 'branded'] as const;
export const bodyType = ['truck', 'sedan', 'suv'] as const;
export const fuelType = ['gas', 'diesel', 'hybrid', 'electric'] as const;
export const marketingStatus = ['not_marketed', 'ready_to_post', 'posted', 'needs_new_post', 'lead_generated'] as const;
export const marketingPlatform = ['facebook_marketplace', 'facebook_post', 'instagram_caption', 'tiktok_caption'] as const;
export const marketingLanguage = ['es', 'en'] as const;

// One customer identity shared across every intake channel (WhatsApp, a
// lead form, a walk-in). `leads`/`deals`/`appointments` keep their own
// free-text name/phone fields untouched for backward compatibility —
// `contactId` is additive so nothing existing breaks. New writers
// (the WhatsApp/agent tool layer especially) should always resolve or
// create a contact first and set contactId, rather than adding another
// disconnected name+phone pair.
export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  phone: text('phone'),                      // E.164 (e.g. +15551234567) — WhatsApp's own identity key
  email: text('email'),
  preferredChannel: text('preferred_channel'), // 'whatsapp' | 'phone' | 'walk-in' | 'facebook' | 'instagram' | 'website'
  source: text('source'),                     // first-touch channel; same vocabulary as leads.source
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({ phoneIdx: index('contacts_phone_idx').on(t.phone) }));

export const lenders = pgTable('lenders', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  contact: text('contact'),
  repPhone: text('rep_phone'),
  notes: text('notes'),
  active: boolean('active').notNull().default(true),
  // Insurance verification (lib/insurance-verification.ts) matches an
  // uploaded declaration page's lienholder address against this, and caps
  // the deductible at this unless the deal's lender overrides it (Veros ->
  // $1,500 instead of the $1,000 default) — set per lender, never guessed.
  address: text('address'),
  maxDeductibleCents: integer('max_deductible_cents').notNull().default(100_000),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const lenderPrograms = pgTable('lender_programs', {
  id: uuid('id').primaryKey().defaultRandom(),
  lenderId: uuid('lender_id').notNull().references(() => lenders.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  advancePct: integer('advance_pct').notNull(),      // 110 = 110% of book
  maxLtvPct: integer('max_ltv_pct'),
  maxTermMonths: integer('max_term_months'),
  maxMiles: integer('max_miles'),
  maxAgeYears: integer('max_age_years'),
  acquisitionFee: integer('acquisition_fee').notNull().default(0),
  allowedTitles: jsonb('allowed_titles').$type<Array<(typeof titleStatus)[number]>>(),

  // Added for lender-match/structuring (lib/lender-match.ts). Nullable —
  // the matcher treats an unset field as "unknown, don't gate on it" rather
  // than guessing, same "never fabricate" rule as extraction.
  minCreditScore: integer('min_credit_score'),
  maxPtiPct: integer('max_pti_pct'),          // payment-to-income cap, e.g. 20 = 20%
  typicalAprBps: integer('typical_apr_bps'),  // basis points, e.g. 1899 = 18.99% — a starting
                                               // point for payment estimates, not a quote

  notes: text('notes'),
});

export const vehicles = pgTable('vehicles', {
  id: uuid('id').primaryKey().defaultRandom(),
  stockNumber: text('stock_number'),
  vin: text('vin'),
  year: integer('year'),
  make: text('make'),
  model: text('model'),
  trim: text('trim'),
  miles: integer('miles'),
  color: text('color'),
  title: text('title').$type<(typeof titleStatus)[number]>().notNull().default('clean'),
  bodyType: text('body_type').$type<(typeof bodyType)[number]>(),
  house: text('house').$type<(typeof auctionHouse)[number]>(),
  runNumber: text('run_number'),
  lot: text('lot'),                                   // which of your own lots it's parked on
  acquiredOn: date('acquired_on'),                    // also drives "days at lot"
  hammer: integer('hammer'),
  buyFee: integer('buy_fee'),
  tow: integer('tow').notNull().default(10000),
  recon: integer('recon').notNull().default(0),
  bookValue: integer('book_value'),                  // JD Power / NADA at time of buy
  askingPrice: integer('asking_price'),
  sold: boolean('sold').notNull().default(false),
  soldOn: date('sold_on'),                            // drives turn velocity + buy scorecard
  notes: text('notes'),
  // Feed lib/marketing-copy.ts's down-payment tiers — never inferred from
  // model/trim text (too unreliable for a figure that goes straight into a
  // customer-facing ad), always set explicitly. isThreeRowSuv only matters
  // when bodyType is 'suv'.
  fuelType: text('fuel_type').$type<(typeof fuelType)[number]>().notNull().default('gas'),
  isThreeRowSuv: boolean('is_three_row_suv').notNull().default(false),
  marketingStatus: text('marketing_status').$type<(typeof marketingStatus)[number]>().notNull().default('not_marketed'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({ vinIdx: index('vehicles_vin_idx').on(t.vin) }));

export const vehiclePhotoStatus = ['uploaded', 'processing', 'edited', 'failed'] as const;

// Backdrop choices offered in the editing panel when preserveOriginalBackground
// is off — all realistic settings a Houston-area dealership could plausibly
// photograph a car in front of. See lib/photo-editor.ts's BACKGROUND_PROMPTS
// for what each one actually asks the model for.
export const vehiclePhotoBackgroundValues = [
  'grass_lot',
  'paved_lot_wall',
  'sunset_sky',
  'houston_skyline',
  'lakeside',
  'studio_gradient',
] as const;

// The knobs from the AI photo-editing panel (components/vehicle-photo-*),
// captured on the photo itself rather than a separate settings table —
// "Regenerate" reruns with whatever's here by default, and a photo's own
// row stays a complete record of how its current edit was produced.
export interface VehiclePhotoEditSettings {
  preserveOriginalBackground: boolean; // true = enhance only, skip the background swap
  background: (typeof vehiclePhotoBackgroundValues)[number]; // only meaningful when preserveOriginalBackground is false
  enhanceQuality: boolean;
  removeLicensePlate: boolean;
  professionalCameraLook: boolean;
  cinematicGrade: boolean;
  cinematicIntensity: number; // 0-100, meaningful only when cinematicGrade is true
  backgroundRealism: number; // 0-100
  imageQuality: number; // 0-100
  turnOnVehicleLights: boolean; // headlights/taillights lit if they appear off in the original
}

// One row per uploaded vehicle photo. originalStoragePath never changes
// once set — every edit (including Regenerate) re-reads the same original
// and overwrites editedStoragePath, so there's exactly one "current" edit
// per photo rather than a version history nobody asked for. See
// lib/photo-editor.ts for what actually produces editedStoragePath.
export const vehiclePhotos = pgTable('vehicle_photos', {
  id: uuid('id').primaryKey().defaultRandom(),
  vehicleId: uuid('vehicle_id').notNull().references(() => vehicles.id, { onDelete: 'cascade' }),
  originalStoragePath: text('original_storage_path').notNull(),
  originalMimeType: text('original_mime_type'),
  editedStoragePath: text('edited_storage_path'),
  editedMimeType: text('edited_mime_type'),
  status: text('status').$type<(typeof vehiclePhotoStatus)[number]>().notNull().default('uploaded'),
  editSettings: jsonb('edit_settings').$type<VehiclePhotoEditSettings>(),
  editError: text('edit_error'),
  sortOrder: integer('sort_order').notNull().default(0),
  editedAt: timestamp('edited_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  vehicleIdx: index('vehicle_photos_vehicle_idx').on(t.vehicleId),
}));

// One row per (vehicle, platform, language) — the current draft/last-posted
// copy for that combination, editable in place rather than an append-only
// log. "Post history" on the Marketing page is read off postedAt across
// these rows rather than a separate events table.
export const marketingPosts = pgTable('marketing_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  vehicleId: uuid('vehicle_id').notNull().references(() => vehicles.id, { onDelete: 'cascade' }),
  platform: text('platform').$type<(typeof marketingPlatform)[number]>().notNull(),
  language: text('language').$type<(typeof marketingLanguage)[number]>().notNull(),
  body: text('body'),
  postedAt: timestamp('posted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  vehicleIdx: index('marketing_posts_vehicle_idx').on(t.vehicleId),
  comboIdx: uniqueIndex('marketing_posts_vehicle_platform_lang_idx').on(t.vehicleId, t.platform, t.language),
}));

export const deals = pgTable('deals', {
  id: uuid('id').primaryKey().defaultRandom(),
  vehicleId: uuid('vehicle_id').references(() => vehicles.id, { onDelete: 'set null' }),
  wantBodyType: text('want_body_type').$type<(typeof bodyType)[number]>(), // what the customer is shopping for, set at New deal
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  customerName: text('customer_name'),
  dealDate: date('deal_date'),
  lenderId: uuid('lender_id').references(() => lenders.id, { onDelete: 'set null' }),
  programId: uuid('program_id').references(() => lenderPrograms.id, { onDelete: 'set null' }),
  salePrice: integer('sale_price'),                   // the design's "sellPrice"
  cashDown: integer('cash_down'),
  tradeAllowance: integer('trade_allowance'),         // superseded by tradeAcv below; kept, unused by new code
  tradePayoff: integer('trade_payoff'),
  termMonths: integer('term_months'),
  apr: integer('apr'),                               // basis points: 1899 = 18.99%

  // Money & trade — see lib/deal-facts.ts for the computed rows (amount
  // financed, front/back/total gross, trade equity) these feed.
  docFee: integer('doc_fee'),
  salesTax: integer('sales_tax'),
  warranty: integer('warranty'),                      // service contract
  gapIns: integer('gap_ins'),
  backEndCost: integer('back_end_cost'),              // what the warranty/GAP actually cost us
  tradeVehicle: text('trade_vehicle'),
  tradeAcv: integer('trade_acv'),

  // backEndGross is kept in sync (warranty + gapIns - backEndCost) by
  // updateMoneyTrade so app/desk/analytics, which predates this section,
  // doesn't need to change.
  backEndGross: integer('back_end_gross').notNull().default(0),

  // Application facts used by dealHealth/nextAction/ptiCalc (lib/deal-facts.ts).
  statedAddress: text('stated_address'),
  idType: text('id_type'),
  // What insurance verification (lib/insurance-verification.ts) matches an
  // uploaded declaration page's lienholder against — entered by hand since
  // it's whichever bank actually funds the deal, not necessarily the
  // dealer's own `lenderId` pick (a deal can be submitted to several).
  lienholderName: text('lienholder_name'),
  statedIncome: integer('stated_income'),
  verifiedIncome: integer('verified_income'),
  // Credit report facts — manual entry until document extraction is
  // wired up (see lib/credit-grade.ts for how these combine into a
  // letter grade).
  fico: integer('fico'),
  inquiries30d: integer('inquiries_30d'),
  repossessions: integer('repossessions'),
  collectionsAmount: integer('collections_amount'),   // cents
  openAutos: integer('open_autos'),
  autoLates: integer('auto_lates'),
  bankruptcies: integer('bankruptcies'),
  mortgages: integer('mortgages'),
  lot: text('lot'),
  payment: integer('payment'),                        // the payment being called out to the customer
  // Manual entry — what the deal actually pays the operator, distinct
  // from totalGross (lib/deal-facts.ts), which is the deal's own
  // front+back gross. Drives the commission/profit toggle on the
  // pipeline board.
  commission: integer('commission'),
  ptiPrice: integer('pti_price'),
  ptiPct: integer('pti_pct'),
  openAutoTradeIn: boolean('open_auto_trade_in').notNull().default(false),
  openAutoPayment: integer('open_auto_payment'),

  // Health-issue acknowledgements: issue key -> acked-at (ms). An acked
  // issue stays visible but stops counting toward the health status —
  // see lib/deal-health.ts.
  ackIssues: jsonb('ack_issues').$type<Record<string, number>>().notNull().default({}),

  // Per-lender submissions (deal.subs[] in the design). lenderId is a
  // real FK here rather than the prototype's string-matched lender name,
  // since we already have a normalized lenders table.
  subs: jsonb('subs')
    .$type<
      Array<{
        id: string;
        lenderId: string;
        at: number;
        status: "sent" | "approved" | "counter" | "declined" | "pulled";
        apr: number | null;
        term: number | null;
        advance: number | null;
        maxPayment: number | null;
        tier: string;
        downReq: number | null;
        stips: string;
        reason: string;
      }>
    >()
    .notNull()
    .default([]),
  primarySubId: text('primary_sub_id'),

  // Activity log (deal.log[] in the design) — free-text entries written
  // by every write path below, capped to the most recent 120.
  log: jsonb('log').$type<Array<{ at: number; text: string }>>().notNull().default([]),

  stips: jsonb('stips').$type<Array<{ label: string; done: boolean }>>().notNull().default([]),

  // The 13-step Application/Approval/Funding checklist from the design
  // (see lib/deal-stage.ts) — step id -> done. This is the source of
  // truth for pipeline position; `funded`/`fundedOn` below are kept in
  // sync automatically (via toggleDealStep) so the existing
  // inventory-sold-sync and buy-scorecard turn-time code, which predate
  // this checklist, don't need to change.
  done: jsonb('done').$type<Record<string, boolean>>().notNull().default({}),
  archived: boolean('archived').notNull().default(false),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  // Set when the deal first reaches the Funding stage; drives the
  // days-in-funding urgency indicator on the pipeline board.
  fundingSince: timestamp('funding_since', { withTimezone: true }),

  funded: boolean('funded').notNull().default(false),
  fundedOn: date('funded_on'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

  // Customer's WhatsApp/SMS number (E.164) — set on New deal, editable
  // from Customer facts. Drives the sold/first-payment and referral
  // WhatsApp automations below (lib/deal-sold.ts); a deal with no phone
  // just skips those, logged rather than silently failing.
  phone: text('phone'),
  // Defaults to fundedOn + 30 days the moment a deal is marked funded
  // (see toggleDealStep) — standard first-payment convention — and stays
  // editable afterward since the actual due date can move.
  firstPaymentDate: date('first_payment_date'),

  // Which post-sale check-in milestones (lib/post-sale-checkins.ts) have
  // already gone out for this deal — e.g. ["30","60"]. Checked before
  // sending so the daily cron never double-texts a customer if it runs
  // more than once on the same day the window opens.
  checkinsSent: jsonb('checkins_sent').$type<string[]>().notNull().default([]),

  // --- Buyer application (Buyer Info / Address / Employment / Other
  // Income) — set at New deal or filled in later from Customer facts.
  // Auto-populated from an uploaded credit app once it's AI-extracted
  // (see applyCreditAppExtraction in app/desk/deals/actions.ts), but only
  // ever into a field that's still blank — never overwrites something
  // the finance manager already typed. `phone` above doubles as cell
  // phone; these add the other two lines from the application. `ssn` is
  // full and manual-entry only — the AI extraction pipeline only ever
  // surfaces ssnLast4 (same last-4-only rule as every other document
  // type in lib/extraction.ts), so a full SSN never goes through the
  // Anthropic API.
  gender: text('gender'),
  dob: date('dob'),
  ssn: text('ssn'),
  homePhone: text('home_phone'),
  workPhone: text('work_phone'),
  email: text('email'),
  idState: text('id_state'),
  idNumber: text('id_number'),
  idIssuedDate: date('id_issued_date'),
  idExpirationDate: date('id_expiration_date'),
  currentAddress: jsonb('current_address').$type<AddressDetail>(),
  previousAddress: jsonb('previous_address').$type<AddressDetail>(),
  currentEmployment: jsonb('current_employment').$type<EmploymentDetail>(),
  previousEmployment: jsonb('previous_employment').$type<EmploymentDetail>(),
  otherIncome: jsonb('other_income').$type<OtherIncomeDetail>(),
});

export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  source: text('source'),                             // channel: "Facebook Marketplace", "Walk-in", etc.
  wants: text('wants'),                              // free text: "Silverado 1500, under 120k"
  wantMake: text('want_make'),                       // parsed, drives run-list want flags
  wantModel: text('want_model'),
  maxMiles: integer('max_miles'),
  maxPayment: integer('max_payment'),
  downAvailable: integer('down_available'),
  status: text('status').notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  // The source webhook's own id for this lead (e.g. Meta's leadgen_id,
  // prefixed "meta:") — lets a retried webhook delivery no-op instead of
  // creating a duplicate lead. Null for every non-webhook source.
  externalId: text('external_id'),
}, t => ({ externalIdIdx: uniqueIndex('leads_external_id_idx').on(t.externalId) }));

export const watchItems = pgTable('watch_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  house: text('house').$type<(typeof auctionHouse)[number]>().notNull(),
  runNumber: text('run_number'),
  saleDate: date('sale_date'),
  year: integer('year'),
  make: text('make'),
  model: text('model'),
  trim: text('trim'),
  miles: integer('miles'),
  vin: text('vin'),
  title: text('title').$type<(typeof titleStatus)[number]>().notNull().default('clean'),
  retail: integer('retail'),
  wholesale: integer('wholesale'),
  reconEstimate: integer('recon_estimate').notNull().default(0),
  announcements: text('announcements'),               // frame, TMU, as-is, red light
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({ saleIdx: index('watch_sale_idx').on(t.saleDate, t.runNumber) }));

// APPEND-ONLY. Every unit watched through a lane, won or lost. Never joined to a
// purchased vehicle, never edited by normal flows, never cascade-deleted. This is the
// operator's own market data and the reason the bid math beats a book value.
export const saleComps = pgTable('sale_comps', {
  id: uuid('id').primaryKey().defaultRandom(),
  observedOn: date('observed_on').notNull(),
  house: text('house').$type<(typeof auctionHouse)[number]>().notNull(),
  runNumber: text('run_number'),
  year: integer('year'),
  make: text('make'),
  model: text('model'),
  trim: text('trim'),
  miles: integer('miles'),
  title: text('title').$type<(typeof titleStatus)[number]>(),
  soldFor: integer('sold_for').notNull(),             // hammer price the lane produced
  ourMaxBid: integer('our_max_bid'),                  // what our math said at the time
  landedCost: integer('landed_cost'),                 // only when we won it
  won: boolean('won').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({ modelIdx: index('comps_model_idx').on(t.make, t.model) }));

// Files attached to a deal, a vehicle, or a lender: TurboPass reports, bank
// statements, credit reports, credit apps, AutoChecks, lender guidelines,
// etc. Exactly one of dealId/vehicleId/lenderId is set, chosen by
// `category` — enforced in the upload action, not the DB. Stored on disk
// locally in dev (lib/storage.ts); swap for Supabase Storage without
// changing this table.
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'cascade' }),
  vehicleId: uuid('vehicle_id').references(() => vehicles.id, { onDelete: 'cascade' }),
  lenderId: uuid('lender_id').references(() => lenders.id, { onDelete: 'cascade' }),
  // A watch_items row is pre-purchase (Sourcing) — an AutoCheck attached
  // there is a scouting reference for a unit that hasn't been bought yet,
  // separate from the AutoCheck a vehicle gets once it's actually owned
  // (vehicleId above). watch_items is otherwise append-only-adjacent (not
  // literally, like sale_comps, but not something else cascades from) so
  // this cascade is safe.
  watchItemId: uuid('watch_item_id').references(() => watchItems.id, { onDelete: 'cascade' }),
  category: text('category').$type<(typeof documentCategory)[number]>().notNull(),
  fileName: text('file_name').notNull(),
  storagePath: text('storage_path').notNull(),       // opaque to the app; see lib/storage.ts
  mimeType: text('mime_type'),
  fileSize: integer('file_size'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),

  // AI extraction (Claude reading the document). Never write UPDATE queries
  // against the original file fields above from this flow — only these.
  extractionStatus: text('extraction_status').$type<(typeof extractionStatus)[number]>().notNull().default('none'),
  extractedData: jsonb('extracted_data'),          // shape depends on `category`, see lib/extraction-schemas.ts
  extractedAt: timestamp('extracted_at', { withTimezone: true }),
  extractionError: text('extraction_error'),
}, t => ({
  dealIdx: index('documents_deal_idx').on(t.dealId),
  vehicleIdx: index('documents_vehicle_idx').on(t.vehicleId),
  lenderIdx: index('documents_lender_idx').on(t.lenderId),
  watchItemIdx: index('documents_watch_item_idx').on(t.watchItemId),
}));

export const appointments = pgTable('appointments', {
  id: uuid('id').primaryKey().defaultRandom(),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'set null' }),
  customerName: text('customer_name').notNull(),
  phone: text('phone'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  // Either a specific unit (vehicleId) or a generic body type (vehicleBodyType)
  // — never both. Set from the deal's own inventory list when scheduled
  // from a deal, so "test drive the truck" doesn't need a stock number yet.
  vehicleId: uuid('vehicle_id').references(() => vehicles.id, { onDelete: 'set null' }),
  vehicleBodyType: text('vehicle_body_type').$type<(typeof bodyType)[number]>(),
  status: text('status').$type<(typeof appointmentStatus)[number]>().notNull().default('scheduled'),
  // Set once Phase 6 (Google Calendar) exists — the calendar's own event id,
  // so a cancel/reschedule from either side can find its counterpart.
  googleCalendarEventId: text('google_calendar_event_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({ scheduledIdx: index('appointments_scheduled_idx').on(t.scheduledAt) }));

// One row per connected third-party service. `config` holds whatever that
// service needs (OAuth tokens, a from-number, etc.) as opaque JSON — never
// rendered back to the client verbatim; routes that read it pick out only
// the fields a page actually needs (e.g. "connected: true/false"), the same
// discipline as storagePath on documents. A single row per provider (this
// is a one-location tool, not multi-tenant), upserted by provider name.
export const integrations = pgTable('integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: text('provider').$type<(typeof integrationProvider)[number]>().notNull().unique(),
  connected: boolean('connected').notNull().default(false),
  config: jsonb('config'),
  connectedAt: timestamp('connected_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// A WhatsApp (or future channel) thread with one phone number. Linked to a
// lead/deal when the phone number matches one on file — set at
// creation and re-checked on each inbound message, since a lead can get
// attached after the thread already exists.
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'set null' }),
  contactPhone: text('contact_phone').notNull(), // E.164, e.g. +15551234567
  contactName: text('contact_name'),
  channel: text('channel').notNull().default('whatsapp'),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  unreadCount: integer('unread_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({ phoneIdx: index('conversations_phone_idx').on(t.contactPhone) }));

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  direction: text('direction').$type<(typeof messageDirection)[number]>().notNull(),
  body: text('body').notNull(),
  status: text('status').$type<(typeof messageStatus)[number]>().notNull().default('queued'),
  providerMessageId: text('provider_message_id'), // Twilio's MessageSid — lets the status-callback webhook find this row
  // Always false for now — every outbound message is a human clicking Send.
  // An auto-reply agent needs its own explicit opt-in (see NOTES_FOR_MATEO.md);
  // this column exists so that toggle only has to change how messages get
  // created, not the schema.
  sentByAgent: boolean('sent_by_agent').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({ convIdx: index('messages_conversation_idx').on(t.conversationId) }));

// The F&I product catalog (service contracts, GAP, tire & wheel, key
// replacement, maintenance plans). Hand-entered per provider's rate
// sheet — this is reference data, not a per-deal record; a deal's
// actual back-end numbers (warranty/gapIns/backEndCost) stay on `deals`
// as they were before this table existed. See lib/warranty-match.ts for
// the eligibility/recommendation rules, which read this table the same
// deterministic way lib/lender-match.ts reads lender_programs — no AI,
// fully auditable.
export const warrantyProducts = pgTable('warranty_products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  provider: text('provider').notNull(),
  productType: text('product_type').$type<(typeof warrantyProductType)[number]>().notNull(),
  costCents: integer('cost_cents').notNull(),   // what the dealership pays the provider
  priceCents: integer('price_cents').notNull(), // what it's sold to the customer for
  termMonths: integer('term_months'),
  termMiles: integer('term_miles'),             // coverage miles added on top of odometer at sale
  deductibleCents: integer('deductible_cents'),
  maxVehicleAgeYears: integer('max_vehicle_age_years'), // eligibility cap: model-year age at time of sale
  maxVehicleMiles: integer('max_vehicle_miles'),        // eligibility cap: odometer at time of sale
  minSalePriceCents: integer('min_sale_price_cents'),
  maxSalePriceCents: integer('max_sale_price_cents'),
  active: boolean('active').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Independent of appointments — a plain to-do ("call lender by Thursday")
// that may or may not be tied to a deal. dealId is nullable so this also
// works as a general reminder list, not just a per-deal one. Overdue/due-
// today tasks feed into the daily desk brief (lib/desk-brief.ts) the same
// way appointments and stips do.
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  dueDate: date('due_date'),
  done: boolean('done').notNull().default(false),
  doneAt: timestamp('done_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({ dealIdx: index('tasks_deal_idx').on(t.dealId) }));
