CREATE TABLE "setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_request" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "booking_request" ALTER COLUMN "status" SET DEFAULT 'requested'::text;--> statement-breakpoint
DROP TYPE "public"."booking_status";--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('requested', 'on_hold', 'confirmed', 'declined', 'cancelled');--> statement-breakpoint
ALTER TABLE "booking_request" ALTER COLUMN "status" SET DEFAULT 'requested'::"public"."booking_status";--> statement-breakpoint
ALTER TABLE "booking_request" ALTER COLUMN "status" SET DATA TYPE "public"."booking_status" USING "status"::"public"."booking_status";--> statement-breakpoint
ALTER TABLE "booking_request" ADD COLUMN "locale" text DEFAULT 'nl' NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_request" ADD COLUMN "confirmed_at" timestamp;--> statement-breakpoint
ALTER TABLE "booking_request" ADD COLUMN "payment_deadline" date;--> statement-breakpoint
ALTER TABLE "booking_request" ADD COLUMN "owner_notes" text;