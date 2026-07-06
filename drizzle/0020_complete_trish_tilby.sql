CREATE TABLE "page" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" jsonb NOT NULL,
	"title_source" jsonb NOT NULL,
	"body" jsonb NOT NULL,
	"body_source" jsonb NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "page_slug_unique" UNIQUE("slug")
);
