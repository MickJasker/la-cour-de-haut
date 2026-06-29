import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { getPublishedPoiBySlug } from "@/lib/poi-queries";
import { PoiDetail } from "@/components/poi-detail";

/**
 * Fetches a published POI by slug and renders its detail, or triggers
 * notFound() for an unknown/unpublished slug. Async server component meant to
 * be wrapped in <Suspense> by each route (the slug-keyed read is request-time
 * data under Cache Components — see ADR-0009).
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
