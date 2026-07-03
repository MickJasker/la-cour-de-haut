import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { PoiDetail } from "@/components/poi-detail";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getPublishedPoiBySlug,
  poiDetailStaticParams,
} from "@/lib/content/poi-queries";
import { pickLocalized } from "@/lib/translation/localized-field";

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
  // The Dialog shell lives in layout.tsx; this render is the Suspense boundary,
  // so its await is what `loading.tsx` covers with the instant skeleton.
  const item = await getPublishedPoiBySlug(slug);
  if (!item) notFound();

  const title = pickLocalized(item.title, loc);
  return (
    <>
      <DialogHeader>
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{title}</DialogDescription>
      </DialogHeader>
      <PoiDetail item={item} locale={loc} />
    </>
  );
}
