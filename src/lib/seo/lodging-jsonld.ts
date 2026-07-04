import "server-only";
import { getDb } from "@/db";
import { review } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { PROPERTY } from "@/lib/property";

/**
 * Structured data (schema.org JSON-LD) for the home page.
 *
 * Type is `LodgingBusiness` rather than Google's `VacationRental`: the latter
 * is an invite-only partner program, whereas `LodgingBusiness` is indexed for
 * independent sites and can surface a rating/price snippet.
 *
 * We only mark up data that is real and visible on the page — Google requires
 * marked-up ratings to be shown to users (the reviews section renders them),
 * The address is the same `PROPERTY` constant the footer renders, and the
 * phone/email are the same owner-editable settings the header renders, so the
 * visible NAP and the structured data can't drift. Phone/email are omitted
 * from the markup when unset (an empty `telephone` is worse than none). We
 * emit no `geo` block: coordinates aren't stored anywhere, and fabricating
 * them is worse than omitting them.
 */

export interface ReviewAggregate {
  ratingValue: number;
  reviewCount: number;
}

/**
 * Average rating + count across published reviews, or null when there are
 * none (in which case `aggregateRating` is omitted from the JSON-LD entirely
 * — an empty rating is a structured-data error, not a zero).
 *
 * Tagged with the shared `reviews` cache tag so publishing/editing a review
 * invalidates it in lockstep with the on-page reviews section (ADR-0016).
 */
export async function getReviewAggregate(): Promise<ReviewAggregate | null> {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.reviews);

  const db = getDb();
  const rows = await db
    .select({ rating: review.rating })
    .from(review)
    .where(eq(review.published, true));

  if (rows.length === 0) return null;

  const sum = rows.reduce((acc, r) => acc + r.rating, 0);
  return {
    // One decimal place — matches how Google renders star snippets.
    ratingValue: Math.round((sum / rows.length) * 10) / 10,
    reviewCount: rows.length,
  };
}

/** Localized region endonym, aligned with the page's `og:locale`. */
const REGION_BY_LOCALE: Record<string, string> = {
  nl: "Normandië",
  fr: "Normandie",
  en: "Normandy",
  de: "Normandie",
};

export interface LodgingJsonLdInput {
  locale: string;
  name: string;
  description: string;
  /** Absolute canonical URL of the localized home page. */
  url: string;
  /** Absolute image URL. */
  image: string;
  /** Nightly price, if configured — rendered as a rough `priceRange`. */
  pricePerNight?: number;
  /** E.164 phone, if set — omitted from the markup when empty. */
  telephone?: string;
  /** Contact email, if set — omitted from the markup when empty. */
  email?: string;
  /** Coordinates — a `geo` block is emitted only when BOTH are present. */
  latitude?: number;
  longitude?: number;
  /** Check-in/out clock times ("16:00"), emitted when set. */
  checkinTime?: string;
  checkoutTime?: string;
  /** Bedroom count → schema `numberOfRooms`, emitted when set. */
  bedrooms?: number;
  aggregate: ReviewAggregate | null;
}

/**
 * Build the JSON-LD object. Pure and synchronous so it stays trivially
 * testable; the caller resolves the data and stamps it into a `<script>`.
 */
export function buildLodgingJsonLd({
  locale,
  name,
  description,
  url,
  image,
  pricePerNight,
  telephone,
  email,
  latitude,
  longitude,
  checkinTime,
  checkoutTime,
  bedrooms,
  aggregate,
}: LodgingJsonLdInput) {
  const hasGeo =
    latitude !== undefined &&
    longitude !== undefined &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);
  return {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    "@id": `${url}#lodging`,
    name,
    description,
    url,
    image,
    address: {
      "@type": "PostalAddress",
      streetAddress: PROPERTY.address.streetAddress,
      postalCode: PROPERTY.address.postalCode,
      addressLocality: PROPERTY.address.addressLocality,
      addressRegion: REGION_BY_LOCALE[locale] ?? "Normandie",
      addressCountry: PROPERTY.address.addressCountry,
    },
    ...(telephone && { telephone }),
    ...(email && { email }),
    ...(hasGeo && {
      geo: {
        "@type": "GeoCoordinates",
        latitude,
        longitude,
      },
    }),
    ...(checkinTime && { checkinTime }),
    ...(checkoutTime && { checkoutTime }),
    ...(bedrooms !== undefined && { numberOfRooms: bedrooms }),
    ...(pricePerNight !== undefined && {
      priceRange: `€${pricePerNight}`,
    }),
    ...(aggregate && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: aggregate.ratingValue,
        reviewCount: aggregate.reviewCount,
        bestRating: 5,
        worstRating: 1,
      },
    }),
  };
}
