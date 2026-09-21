ALTER TABLE "deals" ADD COLUMN "checkins_sent" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "operator_phone" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "operator_email" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "google_review_url" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "leads_external_id_idx" ON "leads" USING btree ("external_id");