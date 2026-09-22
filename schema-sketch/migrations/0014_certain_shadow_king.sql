ALTER TABLE "appointments" ADD COLUMN "vehicle_id" uuid;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "vehicle_body_type" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointments" ADD CONSTRAINT "appointments_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
