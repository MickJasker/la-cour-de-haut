import { getDb } from "@/db";
import { poi } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";

/**
 * A single published POI by slug, or null. Cached and tagged `poi` so it stays
 * prerenderable (required for use in `generateMetadata` under Cache Components)
 * and refreshes on `updateTag("poi")`. Returns the full row (all locales); the
 * caller picks the active locale.
 */
export async function getPublishedPoiBySlug(slug: string) {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.poi);

  const [row] = await getDb()
    .select()
    .from(poi)
    .where(and(eq(poi.slug, slug), eq(poi.published, true)));

  return row ?? null;
}

/**
 * Published POIs as sitemap entries: slug + `lastModified`. POI has no
 * `updatedAt` column, so `createdAt` is the best-available freshness signal —
 * a valid `lastmod` that at least dates the page for crawl scheduling.
 */
export async function getPublishedPoiSitemapEntries(): Promise<
  { slug: string; lastModified: Date }[]
> {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.poi);

  const rows = await getDb()
    .select({ slug: poi.slug, createdAt: poi.createdAt })
    .from(poi)
    .where(eq(poi.published, true))
    .orderBy(asc(poi.sortOrder));

  return rows.map((r) => ({ slug: r.slug, lastModified: r.createdAt }));
}

// Cache Components requires generateStaticParams to return at least one entry,
// even when there are zero published POIs (an empty array throws
// EmptyGenerateStaticParamsError and, since the POI intercept lives in the
// shared [locale] @modal slot, breaks sibling routes too). Fall back to a
// placeholder slug that the detail pages resolve to notFound(). See ADR-0015.
const NO_POI_PLACEHOLDER = "__no-published-pois__";

export async function poiDetailStaticParams(): Promise<{ slug: string }[]> {
  const entries = await getPublishedPoiSitemapEntries();
  return entries.length > 0
    ? entries.map(({ slug }) => ({ slug }))
    : [{ slug: NO_POI_PLACEHOLDER }];
}
