-- Reviews carry their own original language (ADR-0014).
-- Three-step NOT NULL backfill: add nullable, populate, then enforce.
-- Existing reviews were all Dutch-original, so original_locale = 'nl' and
-- original_body = body->>'nl' reproduces their reality exactly.
ALTER TABLE "review" ADD COLUMN "original_locale" text;--> statement-breakpoint
ALTER TABLE "review" ADD COLUMN "original_body" text;--> statement-breakpoint
UPDATE "review" SET "original_locale" = 'nl' WHERE "original_locale" IS NULL;--> statement-breakpoint
UPDATE "review" SET "original_body" = COALESCE("body"->>'nl', '') WHERE "original_body" IS NULL;--> statement-breakpoint
ALTER TABLE "review" ALTER COLUMN "original_locale" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "review" ALTER COLUMN "original_body" SET NOT NULL;
