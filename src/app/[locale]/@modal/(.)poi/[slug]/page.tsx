import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { PoiDetail } from "@/components/poi-detail";
import {
  getPublishedPoiBySlug,
  poiDetailStaticParams,
} from "@/lib/content/poi-queries";
import { pickLocalized } from "@/lib/translation/localized-field";
import { PoiModalClient } from "./poi-modal-client";

// Same as the standalone route: enumerate slugs (with a placeholder fallback
// when none are published) so the intercepted page prerenders with a static
// [locale] shell instead of forcing dynamic params.
export const generateStaticParams = poiDetailStaticParams;

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
    <PoiModalClient title={pickLocalized(item.title, loc)}>
      <PoiDetail item={item} locale={loc} />
    </PoiModalClient>
  );
}
