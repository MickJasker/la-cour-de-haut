ALTER TYPE "public"."booking_status" ADD VALUE 'deposit_paid' BEFORE 'confirmed';--> statement-breakpoint
ALTER TABLE "booking_request" ADD COLUMN "payment_collapsed" boolean;--> statement-breakpoint
ALTER TABLE "booking_request" ADD COLUMN "deposit_amount" numeric;--> statement-breakpoint
ALTER TABLE "booking_request" ADD COLUMN "balance_amount" numeric;--> statement-breakpoint
ALTER TABLE "booking_request" ADD COLUMN "balance_deadline" date;--> statement-breakpoint
ALTER TABLE "booking_request" ADD COLUMN "security_deposit_at_booking" numeric;--> statement-breakpoint
-- Two-stage payment lifecycle (ADR-0021). Honor-what-was-emailed backfill:
-- every existing on_hold / confirmed row predates the payment schedule and was
-- emailed a single full-amount bank transfer with no security deposit. Backfill
-- them as COLLAPSED single-payment bookings so their snapshot matches the email
-- they already received: payment_collapsed = true, borg = 0, the single amount
-- due (= deposit_amount, per the collapsed convention) equal to the total the
-- guest was quoted, still due by their existing payment_deadline. balance_amount
-- / balance_deadline stay NULL. The amount mirrors calculatePriceBreakdown
-- (src/app/[locale]/book/shared.ts): discounted rental + tourism tax.
-- Only touches rows whose snapshot is still NULL, so it is safe to re-run.
UPDATE "booking_request" AS b SET
  "payment_collapsed" = true,
  "security_deposit_at_booking" = 0,
  "deposit_amount" = r."discounted_rental"
    + LEAST(r."discounted_rental" / r."nights" / b."guest_count" * 0.05, 4.5)
      * b."guest_count" * r."nights" * 1.1
FROM (
  SELECT
    "id",
    ("end_date" - "start_date") AS "nights",
    ("shown_price_at_booking" * ("end_date" - "start_date"))
      - CASE
          WHEN ("end_date" - "start_date") >= 7
            THEN "shown_price_at_booking" * ("end_date" - "start_date") * 0.1
          ELSE 0
        END AS "discounted_rental"
  FROM "booking_request"
) AS r
WHERE b."id" = r."id"
  AND b."status" IN ('on_hold', 'confirmed')
  AND b."payment_collapsed" IS NULL;