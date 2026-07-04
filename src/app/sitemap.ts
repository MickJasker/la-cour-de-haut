import type { MetadataRoute } from "next";
import { locales } from "@/i18n/routing";
import { getPublishedPoiSitemapEntries } from "@/lib/content/poi-queries";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://lacourdehaut.fr";

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
  {
    path: "/privacy",
    options: {
      changeFrequency: "yearly",
      priority: 0.1,
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
  // getPublishedPoiSitemapEntries is "use cache"/cacheTag("poi"), so this route
  // stays a cached metadata route and refreshes on updateTag("poi").
  const pois = await getPublishedPoiSitemapEntries();
  return [
    ...PUBLIC_PATHS.flatMap((p) => entriesForPath(p.path, p.options)),
    ...pois.flatMap(({ slug, lastModified }) =>
      entriesForPath(`/poi/${slug}`, {
        lastModified,
        changeFrequency: "weekly",
        priority: 0.8,
      }),
    ),
  ];
}
