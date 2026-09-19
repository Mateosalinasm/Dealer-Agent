import {
  pgTable, uuid, text, integer, boolean, date, timestamp, jsonb, index,
} from 'drizzle-orm/pg-core';

// --- Additions beyond the original 8-table handoff, for the Desk features
// (deal creation, document uploads, appointments, inventory import). See
// CLAUDE.md for the note on why these were added. ---

export const documentCategory = [
  'turbopass', 'bank_statement', 'credit_report', 'credit_app', 'insurance', 'other',
] as const;

export const extractionStatus = ['none', 'pending', 'success', 'failed'] as const;

export const appointmentStatus = ['scheduled', 'completed', 'canceled'] as const;

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
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auctionHouse = ['manheim', 'americas', 'iaa'] as const;
export const titleStatus = ['clean', 'salvage', 'rebuilt', 'flood', 'lemon', 'branded'] as const;

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
  notes: text('notes'),
  active: boolean('active').notNull().default(true),
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
  house: text('house').$type<(typeof auctionHouse)[number]>(),
  runNumber: text('run_number'),
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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({ vinIdx: index('vehicles_vin_idx').on(t.vin) }));

export const deals = pgTable('deals', {
  id: uuid('id').primaryKey().defaultRandom(),
  vehicleId: uuid('vehicle_id').references(() => vehicles.id, { onDelete: 'set null' }),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  customerName: text('customer_name'),
  dealDate: date('deal_date'),
  lenderId: uuid('lender_id').references(() => lenders.id, { onDelete: 'set null' }),
  programId: uuid('program_id').references(() => lenderPrograms.id, { onDelete: 'set null' }),
  salePrice: integer('sale_price'),
  cashDown: integer('cash_down'),
  tradeAllowance: integer('trade_allowance'),
  tradePayoff: integer('trade_payoff'),
  termMonths: integer('term_months'),
  apr: integer('apr'),                               // basis points: 1899 = 18.99%
  backEndGross: integer('back_end_gross').notNull().default(0),
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
});

export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  phone: text('phone'),
  source: text('source'),                             // channel: "Facebook Marketplace", "Walk-in", etc.
  wants: text('wants'),                              // free text: "Silverado 1500, under 120k"
  wantMake: text('want_make'),                       // parsed, drives run-list want flags
  wantModel: text('want_model'),
  maxMiles: integer('max_miles'),
  maxPayment: integer('max_payment'),
  downAvailable: integer('down_available'),
  status: text('status').notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

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

// Files attached to a deal: TurboPass reports, bank statements, credit
// reports, credit apps, insurance, etc. Stored on disk locally in dev
// (lib/storage.ts); swap for Supabase Storage without changing this table.
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealId: uuid('deal_id').notNull().references(() => deals.id, { onDelete: 'cascade' }),
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
}, t => ({ dealIdx: index('documents_deal_idx').on(t.dealId) }));

export const appointments = pgTable('appointments', {
  id: uuid('id').primaryKey().defaultRandom(),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'set null' }),
  customerName: text('customer_name').notNull(),
  phone: text('phone'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  status: text('status').$type<(typeof appointmentStatus)[number]>().notNull().default('scheduled'),
  // Set once Phase 6 (Google Calendar) exists — the calendar's own event id,
  // so a cancel/reschedule from either side can find its counterpart.
  googleCalendarEventId: text('google_calendar_event_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({ scheduledIdx: index('appointments_scheduled_idx').on(t.scheduledAt) }));
