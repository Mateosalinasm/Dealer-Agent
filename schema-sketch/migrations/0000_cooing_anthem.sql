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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lenders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contact" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_gross" integer DEFAULT 320000 NOT NULL,
	"assumed_down" integer DEFAULT 150000 NOT NULL,
	"holding_cost_per_day" integer DEFAULT 1200 NOT NULL,
	"lane_budget" integer,
	"timezone" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointments" ADD CONSTRAINT "appointments_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointments" ADD CONSTRAINT "appointments_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointments" ADD CONSTRAINT "appointments_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deals" ADD CONSTRAINT "deals_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deals" ADD CONSTRAINT "deals_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deals" ADD CONSTRAINT "deals_lender_id_lenders_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."lenders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deals" ADD CONSTRAINT "deals_program_id_lender_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."lender_programs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leads" ADD CONSTRAINT "leads_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lender_programs" ADD CONSTRAINT "lender_programs_lender_id_lenders_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."lenders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointments_scheduled_idx" ON "appointments" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contacts_phone_idx" ON "contacts" USING btree ("phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_deal_idx" ON "documents" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comps_model_idx" ON "sale_comps" USING btree ("make","model");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicles_vin_idx" ON "vehicles" USING btree ("vin");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "watch_sale_idx" ON "watch_items" USING btree ("sale_date","run_number");