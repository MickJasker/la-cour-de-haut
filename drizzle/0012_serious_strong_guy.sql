CREATE TABLE "content_block" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"value_source" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
