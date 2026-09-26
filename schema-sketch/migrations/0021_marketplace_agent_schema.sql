ALTER TABLE "conversations" ALTER COLUMN "contact_phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "vehicle_id" uuid;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "external_thread_id" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "lead_temperature" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "needs_human_attention" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "handoff_reason" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "intent" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "marketplace_agent_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "marketplace_agent_mode" text DEFAULT 'assist' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_external_thread_idx" ON "conversations" USING btree ("external_thread_id");