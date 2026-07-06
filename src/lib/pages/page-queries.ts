import { getDb } from "@/db";
import { page } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";

/**
 * A single published page by slug, or null. Cached and tagged `pages` so it
 * stays prerenderable (required for use in `generateMetadata` under Cache
 * Components) and refreshes on `updateTag("pages")`. Returns the full row
 * (all locales); the caller picks the active locale.
 */
export async function getPublishedPageBySlug(slug: string) {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.pages);

  const [row] = await getDb()
    .select()
    .from(page)
    .where(and(eq(page.slug, slug), eq(page.published, true)));

  return row ?? null;
}

/**
 * Published pages as sitemap entries: slug + `lastModified` from `updatedAt`,
 * so an owner edit refreshes the page's crawl signal.
 */
export async function getPublishedPageSitemapEntries(): Promise<
  { slug: string; lastModified: Date }[]
> {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.pages);

  const rows = await getDb()
    .select({ slug: page.slug, updatedAt: page.updatedAt })
    .from(page)
    .where(eq(page.published, true))
    .orderBy(asc(page.createdAt));

  return rows.map((r) => ({ slug: r.slug, lastModified: r.updatedAt }));
}

// Cache Components requires generateStaticParams to return at least one
// entry (an empty array throws EmptyGenerateStaticParamsError). The system
// pages guarantee two published rows in practice, but keep the same
// placeholder fallback poi-queries.ts uses so an empty table can never break
// the [locale] tree. See ADR-0015/ADR-0020.
const NO_PAGE_PLACEHOLDER = "__no-published-pages__";

export async function pageStaticParams(): Promise<{ slug: string }[]> {
  const entries = await getPublishedPageSitemapEntries();
  return entries.length > 0
    ? entries.map(({ slug }) => ({ slug }))
    : [{ slug: NO_PAGE_PLACEHOLDER }];
}
