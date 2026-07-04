import { hasLocale, type Locale } from "@/i18n/routing";
import { pickLocalized } from "@/lib/translation/localized-field";
import { getPublishedPoiBySlug } from "@/lib/content/poi-queries";
import { renderOgCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/seo/og-card";

export const alt = "La Cour de Haut";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const REGION: Record<string, string> = {
  nl: "Ontdek Normandië",
  fr: "Découvrez la Normandie",
  en: "Discover Normandy",
  de: "Entdecke die Normandie",
};

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const loc = (hasLocale(locale) ? locale : "nl") as Locale;
  const item = await getPublishedPoiBySlug(slug);

  // Fall back to the region tagline when the POI title is unavailable (e.g. the
  // placeholder slug) so the route always renders a valid card.
  const title = item ? pickLocalized(item.title, loc) : "La Cour de Haut";

  // Deliberately NO background photo: POI images are owner-uploaded at
  // arbitrary resolution, and a full-res JPEG overruns next/og's rasterizer
  // buffer limit (500s the route). A solid forest card always renders. The
  // richer photo card is reserved for the home OG, whose hero is a controlled,
  // build-time local asset.
  return renderOgCard({
    eyebrow: "La Cour de Haut",
    title,
    subtitle: REGION[loc] ?? REGION.nl,
    backgroundSrc: "",
  });
}
