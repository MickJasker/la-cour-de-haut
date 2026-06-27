-- add new jsonb columns
ALTER TABLE "poi" ADD COLUMN "title_new" jsonb;
ALTER TABLE "poi" ADD COLUMN "body_new" jsonb;
ALTER TABLE "poi" ADD COLUMN "title_source" jsonb;
ALTER TABLE "poi" ADD COLUMN "body_source" jsonb;

-- migrate existing data
UPDATE "poi" SET
  "title_new"    = jsonb_build_object('nl', "title"),
  "body_new"     = jsonb_build_object('nl', "body"),
  "title_source" = jsonb_build_object('nl', 'human'),
  "body_source"  = jsonb_build_object('nl', 'human');

-- set NOT NULL
ALTER TABLE "poi" ALTER COLUMN "title_new" SET NOT NULL;
ALTER TABLE "poi" ALTER COLUMN "body_new"  SET NOT NULL;
ALTER TABLE "poi" ALTER COLUMN "title_source" SET NOT NULL;
ALTER TABLE "poi" ALTER COLUMN "body_source"  SET NOT NULL;

-- swap
ALTER TABLE "poi" DROP COLUMN "title";
ALTER TABLE "poi" DROP COLUMN "body";
ALTER TABLE "poi" RENAME COLUMN "title_new" TO "title";
ALTER TABLE "poi" RENAME COLUMN "body_new"  TO "body";
