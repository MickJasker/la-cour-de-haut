import type { Metadata } from "next";
import { locales, type Locale } from "@/i18n/routing";
import { getTranslations } from "@/i18n/server";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/sections/site-header";
import { Button } from "@/components/ui/button";
import { PoiDetailLoader } from "@/components/poi-detail-loader";
import {
  getPublishedPoiBySlug,
  poiDetailStaticParams,
} from "@/lib/content/poi-queries";
import { pickLocalized } from "@/lib/translation/localized-field";
import { truncateForMeta } from "@/lib/seo/meta-text";
import { buildPoiJsonLd } from "@/lib/seo/poi-jsonld";
import { getBaseUrl } from "@/lib/base-url";

const BASE_URL = getBaseUrl();

// Enumerate published slugs so each detail page prerenders (await params is
// static for known slugs); new slugs render on-demand. Returns a placeholder
// when there are no published POIs (Cache Components forbids an empty array).
export const generateStaticParams = poiDetailStaticParams;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const item = await getPublishedPoiBySlug(slug);
  if (!item) return {};

  const loc = locale as Locale;
  const title = pickLocalized(item.title, loc);
  const description = truncateForMeta(pickLocalized(item.body, loc));

  return {
    title,
    description,
    alternates: {
      canonical: `${BASE_URL}/${locale}/poi/${slug}`,
      languages: Object.fromEntries([
        ...locales.map((l) => [l, `${BASE_URL}/${l}/poi/${slug}`]),
        ["x-default", `${BASE_URL}/nl/poi/${slug}`],
      ]),
    },
    // og:image comes from the poi opengraph-image route file.
    openGraph: {
      url: `${BASE_URL}/${locale}/poi/${slug}`,
      title,
      description,
    },
  };
}

export default async function PoiPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "booking",
  });

  // Cached read (dedupes with generateMetadata); null for the placeholder slug
  // or an unpublished POI, in which case PoiDetailLoader renders notFound().
  const item = await getPublishedPoiBySlug(slug);
  const loc = locale as Locale;
  const jsonLd = item
    ? buildPoiJsonLd({
        locale,
        name: pickLocalized(item.title, loc),
        description: truncateForMeta(pickLocalized(item.body, loc)),
        image: item.imageUrl,
        url: `${BASE_URL}/${locale}/poi/${slug}`,
        homeUrl: `${BASE_URL}/${locale}`,
        homeLabel: "La Cour de Haut",
      })
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
      )}
      <SiteHeader
        action={
          <Button
            asChild
            className="w-full md:col-start-10 lg:col-start-11 md:col-end-14"
            size="lg"
          >
            <Link href={`/`}>{t("aboutAction")}</Link>
          </Button>
        }
      />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col p-6">
        <PoiDetailLoader slug={slug} locale={locale as Locale} />
        <div className="h-22" />
      </main>
    </>
  );
}
