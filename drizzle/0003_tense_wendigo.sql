CREATE TYPE "public"."booking_status" AS ENUM('pending', 'confirmed', 'rejected', 'cancelled', 'completed');--> statement-breakpoint
CREATE TABLE "booking_request" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"guest_count" integer DEFAULT 1 NOT NULL,
	"phone" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"message" text,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
