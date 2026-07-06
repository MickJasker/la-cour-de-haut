import type { MetadataRoute } from "next";
import { locales } from "@/i18n/routing";
import { getPublishedPoiSitemapEntries } from "@/lib/content/poi-queries";
import { getPublishedPageSitemapEntries } from "@/lib/pages/page-queries";
import { getBaseUrl } from "@/lib/base-url";

const BASE_URL = getBaseUrl();

type SitemapEntryOptions = Omit<
  MetadataRoute.Sitemap[number],
  "url" | "alternates"
>;

const PUBLIC_PATHS = [
  {
    path: "",
    options: {
      changeFrequency: "weekly",
      priority: 1,
    },
  },
  {
    path: "/book",
    options: {
      changeFrequency: "hourly",
      priority: 0.9,
    },
  },
] as const satisfies Array<{
  path: string;
  options?: SitemapEntryOptions;
}>;

function entriesForPath(
  path: string,
  options?: SitemapEntryOptions,
): MetadataRoute.Sitemap {
  return locales.map((locale) => ({
    url: `${BASE_URL}/${locale}${path}`,
    alternates: {
      languages: Object.fromEntries([
        ...locales.map((loc) => [loc, `${BASE_URL}/${loc}${path}`]),
        ["x-default", `${BASE_URL}/nl${path}`],
      ]),
    },
    ...options,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Both queries are "use cache"/cacheTag'd, so this route stays a cached
  // metadata route and refreshes on updateTag("poi") / updateTag("pages").
  // Owner-managed pages (ADR-0020) replace the former static /privacy entry;
  // unpublished pages are already filtered out by the query.
  const [pois, pages] = await Promise.all([
    getPublishedPoiSitemapEntries(),
    getPublishedPageSitemapEntries(),
  ]);
  return [
    ...PUBLIC_PATHS.flatMap((p) => entriesForPath(p.path, p.options)),
    ...pois.flatMap(({ slug, lastModified }) =>
      entriesForPath(`/poi/${slug}`, {
        lastModified,
        changeFrequency: "weekly",
        priority: 0.8,
      }),
    ),
    ...pages.flatMap(({ slug, lastModified }) =>
      entriesForPath(`/${slug}`, {
        lastModified,
        changeFrequency: "yearly",
        priority: 0.3,
      }),
    ),
  ];
}
