ALTER TABLE "deals" ADD COLUMN "lienholder_name" text;--> statement-breakpoint
ALTER TABLE "lenders" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "lenders" ADD COLUMN "max_deductible_cents" integer DEFAULT 100000 NOT NULL;