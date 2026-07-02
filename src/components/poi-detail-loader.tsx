import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { getPublishedPoiBySlug } from "@/lib/content/poi-queries";
import { PoiDetail } from "@/components/poi-detail";

/**
 * Fetches a published POI by slug and renders its detail, or triggers
 * notFound() for an unknown/unpublished slug. The slug query is "use cache",
 * and the routes enumerate slugs via generateStaticParams, so this prerenders
 * to static HTML per slug — no <Suspense> needed (unlike booking, which streams
 * a request-time read). Shared by the standalone page and the modal intercept.
 */
export async function PoiDetailLoader({
  slug,
  locale,
}: {
  slug: string;
  locale: Locale;
}) {
  const item = await getPublishedPoiBySlug(slug);
  if (!item) notFound();
  return <PoiDetail item={item} locale={locale} />;
}
