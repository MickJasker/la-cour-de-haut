CREATE TABLE "owner_block" (
	"id" text PRIMARY KEY NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"label" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
