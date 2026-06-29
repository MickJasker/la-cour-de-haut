import { getDb } from "@/db";
import { poi } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

/**
 * A single published POI by slug, or null. Cached and tagged `poi` so it stays
 * prerenderable (required for use in `generateMetadata` under Cache Components)
 * and refreshes on `updateTag("poi")`. Returns the full row (all locales); the
 * caller picks the active locale.
 */
export async function getPublishedPoiBySlug(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("poi");

  const [row] = await getDb()
    .select()
    .from(poi)
    .where(and(eq(poi.slug, slug), eq(poi.published, true)));

  return row ?? null;
}

/** Slugs of all published POIs (for the sitemap), ordered like the section. */
export async function getPublishedPoiSlugs(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("poi");

  const rows = await getDb()
    .select({ slug: poi.slug })
    .from(poi)
    .where(eq(poi.published, true))
    .orderBy(asc(poi.sortOrder));

  return rows.map((r) => r.slug);
}

// Cache Components requires generateStaticParams to return at least one entry,
// even when there are zero published POIs (an empty array throws
// EmptyGenerateStaticParamsError and, since the POI intercept lives in the
// shared [locale] @modal slot, breaks sibling routes too). Fall back to a
// placeholder slug that the detail pages resolve to notFound(). See ADR-0015.
const NO_POI_PLACEHOLDER = "__no-published-pois__";

export async function poiDetailStaticParams(): Promise<{ slug: string }[]> {
  const slugs = await getPublishedPoiSlugs();
  return slugs.length > 0
    ? slugs.map((slug) => ({ slug }))
    : [{ slug: NO_POI_PLACEHOLDER }];
}
