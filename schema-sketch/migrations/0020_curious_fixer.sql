CREATE TABLE IF NOT EXISTS "extension_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "extension_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "marketing_posts" ADD COLUMN "posted_via" text;--> statement-breakpoint
ALTER TABLE "marketing_posts" ADD COLUMN "external_listing_url" text;--> statement-breakpoint
ALTER TABLE "marketing_posts" ADD COLUMN "queued_for_auto_post" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "marketing_posts" ADD COLUMN "queued_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "marketing_posts" ADD COLUMN "auto_post_error" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "auto_post_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "auto_post_max_per_day" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "auto_post_times" jsonb DEFAULT '["09:00"]'::jsonb NOT NULL;