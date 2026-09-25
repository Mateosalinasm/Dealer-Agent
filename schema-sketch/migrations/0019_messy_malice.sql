CREATE TABLE IF NOT EXISTS "vehicle_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"original_storage_path" text NOT NULL,
	"original_mime_type" text,
	"edited_storage_path" text,
	"edited_mime_type" text,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"edit_settings" jsonb,
	"edit_error" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicle_photos_vehicle_idx" ON "vehicle_photos" USING btree ("vehicle_id");