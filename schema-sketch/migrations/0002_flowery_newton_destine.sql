ALTER TABLE "deals" ADD COLUMN "doc_fee" integer;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "sales_tax" integer;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "warranty" integer;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "gap_ins" integer;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "back_end_cost" integer;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "trade_vehicle" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "trade_acv" integer;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "stated_address" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "id_type" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "stated_income" integer;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "verified_income" integer;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "pti_price" integer;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "pti_pct" integer;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "open_auto_trade_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "open_auto_payment" integer;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "ack_issues" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "subs" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "primary_sub_id" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "log" jsonb DEFAULT '[]'::jsonb NOT NULL;