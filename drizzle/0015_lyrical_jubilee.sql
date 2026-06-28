ALTER TABLE "booking_request" ADD COLUMN "address" text NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_request" ADD COLUMN "postal_code" text NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_request" ADD COLUMN "city" text NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_request" ADD COLUMN "country" text NOT NULL;