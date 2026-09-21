-- Catch-up script: combines every migration (0000 through 0010) into one
-- idempotent run. Safe to run against a database that's missing some or
-- all of these, in any partial state — every statement skips cleanly if
-- that table/column/constraint/index already exists.
--
-- One-time use: paste this whole file into the Supabase SQL Editor (or
-- run via psql -f) and run it once. After this, your database matches
-- schema-sketch/schema.ts as of migration 0010.

-- --- 0000: base 11 tables ---

CREATE TABLE IF NOT EXISTS "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid,
	"lead_id" uuid,
	"deal_id" uuid,
	"customer_name" text NOT NULL,
	"phone" text,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"google_calendar_event_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"phone" text,
	"email" text,
	"preferred_channel" text,
	"source" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid,
	"contact_id" uuid,
	"customer_name" text,
	"deal_date" date,
	"lender_id" uuid,
	"program_id" uuid,
	"sale_price" integer,
	"cash_down" integer,
	"trade_allowance" integer,
	"trade_payoff" integer,
	"term_months" integer,
	"apr" integer,
	"back_end_gross" integer DEFAULT 0 NOT NULL,
	"stips" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"funded" boolean DEFAULT false NOT NULL,
	"funded_on" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid,
	"category" text NOT NULL,
	"file_name" text NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" text,
	"file_size" integer,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"extraction_status" text DEFAULT 'none' NOT NULL,
	"extracted_data" jsonb,
	"extracted_at" timestamp with time zone,
	"extraction_error" text
);

CREATE TABLE IF NOT EXISTS "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid,
	"name" text NOT NULL,
	"phone" text,
	"source" text,
	"wants" text,
	"want_make" text,
	"want_model" text,
	"max_miles" integer,
	"max_payment" integer,
	"down_available" integer,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "lender_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lender_id" uuid NOT NULL,
	"label" text NOT NULL,
	"advance_pct" integer NOT NULL,
	"max_ltv_pct" integer,
	"max_term_months" integer,
	"max_miles" integer,
	"max_age_years" integer,
	"acquisition_fee" integer DEFAULT 0 NOT NULL,
	"allowed_titles" jsonb,
	"min_credit_score" integer,
	"max_pti_pct" integer,
	"typical_apr_bps" integer,
	"notes" text
);

CREATE TABLE IF NOT EXISTS "lenders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contact" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sale_comps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"observed_on" date NOT NULL,
	"house" text NOT NULL,
	"run_number" text,
	"year" integer,
	"make" text,
	"model" text,
	"trim" text,
	"miles" integer,
	"title" text,
	"sold_for" integer NOT NULL,
	"our_max_bid" integer,
	"landed_cost" integer,
	"won" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_gross" integer DEFAULT 320000 NOT NULL,
	"assumed_down" integer DEFAULT 150000 NOT NULL,
	"holding_cost_per_day" integer DEFAULT 1200 NOT NULL,
	"lane_budget" integer,
	"timezone" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stock_number" text,
	"vin" text,
	"year" integer,
	"make" text,
	"model" text,
	"trim" text,
	"miles" integer,
	"color" text,
	"title" text DEFAULT 'clean' NOT NULL,
	"house" text,
	"run_number" text,
	"acquired_on" date,
	"hammer" integer,
	"buy_fee" integer,
	"tow" integer DEFAULT 10000 NOT NULL,
	"recon" integer DEFAULT 0 NOT NULL,
	"book_value" integer,
	"asking_price" integer,
	"sold" boolean DEFAULT false NOT NULL,
	"sold_on" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "watch_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"house" text NOT NULL,
	"run_number" text,
	"sale_date" date,
	"year" integer,
	"make" text,
	"model" text,
	"trim" text,
	"miles" integer,
	"vin" text,
	"title" text DEFAULT 'clean' NOT NULL,
	"retail" integer,
	"wholesale" integer,
	"recon_estimate" integer DEFAULT 0 NOT NULL,
	"announcements" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "appointments" ADD CONSTRAINT "appointments_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "appointments" ADD CONSTRAINT "appointments_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "appointments" ADD CONSTRAINT "appointments_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "deals" ADD CONSTRAINT "deals_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "deals" ADD CONSTRAINT "deals_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "deals" ADD CONSTRAINT "deals_lender_id_lenders_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."lenders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "deals" ADD CONSTRAINT "deals_program_id_lender_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."lender_programs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "leads" ADD CONSTRAINT "leads_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "lender_programs" ADD CONSTRAINT "lender_programs_lender_id_lenders_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."lenders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "appointments_scheduled_idx" ON "appointments" USING btree ("scheduled_at");
CREATE INDEX IF NOT EXISTS "contacts_phone_idx" ON "contacts" USING btree ("phone");
CREATE INDEX IF NOT EXISTS "documents_deal_idx" ON "documents" USING btree ("deal_id");
CREATE INDEX IF NOT EXISTS "comps_model_idx" ON "sale_comps" USING btree ("make","model");
CREATE INDEX IF NOT EXISTS "vehicles_vin_idx" ON "vehicles" USING btree ("vin");
CREATE INDEX IF NOT EXISTS "watch_sale_idx" ON "watch_items" USING btree ("sale_date","run_number");

-- --- 0001 ---
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "done" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "archived" boolean DEFAULT false NOT NULL;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "funding_since" timestamp with time zone;
UPDATE "deals" SET "done" = '{
  "credit": true, "income": true, "structure": true, "submit": true,
  "approval": true, "present": true, "signoff": true, "contracts": true,
  "stips": true, "plates": true, "bank": true, "booked": true, "funded": true
}'::jsonb
WHERE "funded" = true AND "done" = '{}'::jsonb;

-- --- 0002 ---
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "doc_fee" integer;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "sales_tax" integer;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "warranty" integer;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "gap_ins" integer;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "back_end_cost" integer;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "trade_vehicle" text;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "trade_acv" integer;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "stated_address" text;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "id_type" text;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "stated_income" integer;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "verified_income" integer;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "pti_price" integer;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "pti_pct" integer;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "open_auto_trade_in" boolean DEFAULT false NOT NULL;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "open_auto_payment" integer;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "ack_issues" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "subs" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "primary_sub_id" text;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "log" jsonb DEFAULT '[]'::jsonb NOT NULL;

-- --- 0003 ---
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "fico" integer;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "lot" text;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "payment" integer;

-- --- 0004 ---
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "commission" integer;

-- --- 0005 ---
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "inquiries_30d" integer;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "repossessions" integer;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "collections_amount" integer;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "open_autos" integer;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "auto_lates" integer;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "bankruptcies" integer;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "mortgages" integer;

-- --- 0006 ---
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "body_type" text;

-- --- 0007 ---
ALTER TABLE "documents" ALTER COLUMN "deal_id" DROP NOT NULL;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "vehicle_id" uuid;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "lender_id" uuid;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "lot" text;
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_lender_id_lenders_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."lenders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "documents_vehicle_idx" ON "documents" USING btree ("vehicle_id");
CREATE INDEX IF NOT EXISTS "documents_lender_idx" ON "documents" USING btree ("lender_id");

-- --- 0008 ---
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "want_body_type" text;

-- --- 0009 ---
CREATE TABLE IF NOT EXISTS "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid,
	"deal_id" uuid,
	"contact_phone" text NOT NULL,
	"contact_name" text,
	"channel" text DEFAULT 'whatsapp' NOT NULL,
	"last_message_at" timestamp with time zone,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"connected" boolean DEFAULT false NOT NULL,
	"config" jsonb,
	"connected_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integrations_provider_unique" UNIQUE("provider")
);

CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"provider_message_id" text,
	"sent_by_agent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "conversations_phone_idx" ON "conversations" USING btree ("contact_phone");
CREATE INDEX IF NOT EXISTS "messages_conversation_idx" ON "messages" USING btree ("conversation_id");

-- --- 0010 ---
CREATE TABLE IF NOT EXISTS "warranty_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"product_type" text NOT NULL,
	"cost_cents" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"term_months" integer,
	"term_miles" integer,
	"deductible_cents" integer,
	"max_vehicle_age_years" integer,
	"max_vehicle_miles" integer,
	"min_sale_price_cents" integer,
	"max_sale_price_cents" integer,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "first_payment_date" date;

-- --- 0011 ---
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "watch_item_id" uuid;
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_watch_item_id_watch_items_id_fk" FOREIGN KEY ("watch_item_id") REFERENCES "public"."watch_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "documents_watch_item_idx" ON "documents" USING btree ("watch_item_id");
