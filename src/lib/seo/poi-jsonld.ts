import { PROPERTY } from "@/lib/property";
import { regionForLocale } from "@/lib/seo/region";

/**
 * Structured data for a POI ("point of interest") detail page.
 *
 * Emits two nodes in a `@graph`:
 * - `TouristAttraction` — the place itself, situated in the gîte's region so it
 *   reinforces the local relevance ("things to do near Juvigny les Vallées").
 * - `BreadcrumbList` — Home → POI, which can render a breadcrumb trail in the
 *   search result instead of a raw URL.
 *
 * Pure/synchronous, mirroring `buildLodgingJsonLd`; the caller resolves the
 * localized text and stamps the result into a scrubbed `<script>`.
 */

export interface PoiJsonLdInput {
  locale: string;
  name: string;
  description: string;
  image: string;
  /** Absolute canonical URL of the localized POI page. */
  url: string;
  /** Absolute URL of the localized home page (breadcrumb root). */
  homeUrl: string;
  /** Localized label for the breadcrumb home crumb (e.g. "Home"). */
  homeLabel: string;
}

export function buildPoiJsonLd({
  locale,
  name,
  description,
  image,
  url,
  homeUrl,
  homeLabel,
}: PoiJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TouristAttraction",
        "@id": `${url}#attraction`,
        name,
        description,
        image,
        url,
        address: {
          "@type": "PostalAddress",
          addressRegion: regionForLocale(locale),
          addressCountry: PROPERTY.address.addressCountry,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: homeLabel,
            item: homeUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name,
            item: url,
          },
        ],
      },
    ],
  };
}
