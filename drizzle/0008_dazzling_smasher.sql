CREATE TABLE "review" (
	"id" text PRIMARY KEY NOT NULL,
	"author_name" text NOT NULL,
	"rating" integer NOT NULL,
	"review_date" date NOT NULL,
	"source" text NOT NULL,
	"body" jsonb NOT NULL,
	"body_source" jsonb NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
