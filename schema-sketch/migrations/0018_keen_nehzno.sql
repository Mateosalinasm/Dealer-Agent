ALTER TABLE "deals" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "dob" date;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "ssn" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "home_phone" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "work_phone" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "id_state" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "id_number" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "id_issued_date" date;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "id_expiration_date" date;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "current_address" jsonb;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "previous_address" jsonb;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "current_employment" jsonb;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "previous_employment" jsonb;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "other_income" jsonb;