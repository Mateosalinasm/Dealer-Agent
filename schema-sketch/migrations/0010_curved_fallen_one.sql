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
--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "first_payment_date" date;