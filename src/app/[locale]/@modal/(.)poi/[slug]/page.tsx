import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { PoiDetail } from "@/components/poi-detail";
import { getPublishedPoiBySlug, getPublishedPoiSlugs } from "@/lib/poi-queries";
import { PoiModalClient } from "./poi-modal-client";

// Same as the standalone route: enumerate slugs so the intercepted page
// prerenders with a static [locale] shell instead of forcing dynamic params.
export async function generateStaticParams() {
  const slugs = await getPublishedPoiSlugs();
  return slugs.map((slug) => ({ slug }));
}

export default async function PoiModalPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const loc = locale as Locale;
  // Cache hit on getPublishedPoiBySlug (same "use cache" key as the render).
  // Fetched here so the dialog's accessible name is the POI title.
  const item = await getPublishedPoiBySlug(slug);
  if (!item) notFound();

  return (
    <PoiModalClient title={item.title[loc] ?? item.title.nl}>
      <PoiDetail item={item} locale={loc} />
    </PoiModalClient>
  );
}
