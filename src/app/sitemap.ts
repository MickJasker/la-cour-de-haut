import type { MetadataRoute } from "next";
import { locales } from "@/i18n/routing";
import { getPublishedPoiSlugs } from "@/lib/poi-queries";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://lacourdehaut.fr";

const PUBLIC_PATHS = ["", "/book", "/privacy"] as const;

function entriesForPath(path: string): MetadataRoute.Sitemap {
  return locales.map((locale) => ({
    url: `${BASE_URL}/${locale}${path}`,
    alternates: {
      languages: Object.fromEntries([
        ...locales.map((loc) => [loc, `${BASE_URL}/${loc}${path}`]),
        ["x-default", `${BASE_URL}/nl${path}`],
      ]),
    },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // getPublishedPoiSlugs is "use cache"/cacheTag("poi"), so this route stays a
  // cached metadata route and refreshes on updateTag("poi").
  const slugs = await getPublishedPoiSlugs();
  return [
    ...PUBLIC_PATHS.flatMap(entriesForPath),
    ...slugs.flatMap((slug) => entriesForPath(`/poi/${slug}`)),
  ];
}
