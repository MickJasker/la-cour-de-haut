import type { Locale } from "@/i18n/routing";
import { PoiDetailLoader } from "@/components/poi-detail-loader";
import { getPublishedPoiSlugs } from "@/lib/poi-queries";
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

  return (
    <PoiModalClient>
      <PoiDetailLoader slug={slug} locale={locale as Locale} />
    </PoiModalClient>
  );
}
