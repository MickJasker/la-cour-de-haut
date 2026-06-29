-- Add `slug` as nullable first so the backfill can populate existing rows
-- before the NOT NULL + UNIQUE constraints are applied (hand-edited; drizzle-kit
-- emits a bare `ADD COLUMN slug text NOT NULL` that would fail on existing data
-- and on the production build's db:migrate step). See ADR-0015.
ALTER TABLE "poi" ADD COLUMN "slug" text;--> statement-breakpoint

-- Backfill: slugify the Dutch title (lowercase, non-alphanumerics -> single
-- hyphen, trimmed), deduping collisions with a numeric suffix. Accented chars
-- collapse to hyphens here (no `unaccent` extension); the app layer strips
-- diacritics properly for new rows.
WITH slugified AS (
  SELECT
    id,
    NULLIF(
      trim(both '-' from regexp_replace(lower(title->>'nl'), '[^a-z0-9]+', '-', 'g')),
      ''
    ) AS base
  FROM "poi"
),
numbered AS (
  SELECT
    id,
    COALESCE(base, 'poi') AS base,
    row_number() OVER (PARTITION BY COALESCE(base, 'poi') ORDER BY id) AS rn
  FROM slugified
)
UPDATE "poi" p
SET slug = CASE WHEN n.rn = 1 THEN n.base ELSE n.base || '-' || n.rn END
FROM numbered n
WHERE p.id = n.id;--> statement-breakpoint

ALTER TABLE "poi" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "poi" ADD COLUMN "detail" jsonb;--> statement-breakpoint
ALTER TABLE "poi" ADD COLUMN "detail_source" jsonb;--> statement-breakpoint
ALTER TABLE "poi" ADD CONSTRAINT "poi_slug_unique" UNIQUE("slug");
