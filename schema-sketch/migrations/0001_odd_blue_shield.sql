ALTER TABLE "deals" ADD COLUMN "done" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "funding_since" timestamp with time zone;--> statement-breakpoint
-- Backfill: deals already marked funded under the old standalone
-- `funded` flag need every checklist step checked too, or the new
-- pipeline board (which derives stage purely from `done`) would show
-- them as freshly started instead of funded.
UPDATE "deals" SET "done" = '{
  "credit": true, "income": true, "structure": true, "submit": true,
  "approval": true, "present": true, "signoff": true, "contracts": true,
  "stips": true, "plates": true, "bank": true, "booked": true, "funded": true
}'::jsonb
WHERE "funded" = true;