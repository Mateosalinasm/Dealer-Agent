CREATE TABLE IF NOT EXISTS "marketing_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"language" text NOT NULL,
	"body" text,
	"posted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "fuel_type" text DEFAULT 'gas' NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "is_three_row_suv" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "marketing_status" text DEFAULT 'not_marketed' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marketing_posts" ADD CONSTRAINT "marketing_posts_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_posts_vehicle_idx" ON "marketing_posts" USING btree ("vehicle_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "marketing_posts_vehicle_platform_lang_idx" ON "marketing_posts" USING btree ("vehicle_id","platform","language");