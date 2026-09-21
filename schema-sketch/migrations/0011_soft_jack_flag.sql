ALTER TABLE "documents" ADD COLUMN "watch_item_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_watch_item_id_watch_items_id_fk" FOREIGN KEY ("watch_item_id") REFERENCES "public"."watch_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_watch_item_idx" ON "documents" USING btree ("watch_item_id");