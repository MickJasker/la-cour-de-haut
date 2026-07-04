import type { Metadata } from "next";
import { SiteHeader } from "@/components/sections/site-header";
import { Hero } from "@/components/sections/hero";
import { GiteSection } from "@/components/sections/gite";
import { ReviewsSection } from "@/components/sections/reviews";
import { PoiSection } from "@/components/sections/poi";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "@/i18n/server";
import { locales, type Locale } from "@/i18n/routing";
import { getSettings } from "@/lib/settings/settings";
import { toE164 } from "@/lib/phone";
import {
  buildLodgingJsonLd,
  getReviewAggregate,
} from "@/lib/seo/lodging-jsonld";
import HeroImage from "@/components/sections/hero.jpg";
import { AboutUsSection } from "@/components/sections/about-us";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://lacourdehaut.fr";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    alternates: {
      canonical: `${BASE_URL}/${locale}`,
      languages: Object.fromEntries([
        ...locales.map((loc) => [loc, `${BASE_URL}/${loc}`]),
        ["x-default", `${BASE_URL}/nl`],
      ]),
    },
    // og:image comes from the opengraph-image route file; only the canonical
    // per-locale URL is set here.
    openGraph: {
      url: `${BASE_URL}/${locale}`,
    },
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [t, meta, settings, aggregate] = await Promise.all([
    getTranslations({ locale: locale as Locale, namespace: "sections.header" }),
    getTranslations({ locale: locale as Locale, namespace: "metadata.home" }),
    getSettings(),
    getReviewAggregate(),
  ]);

  const jsonLd = buildLodgingJsonLd({
    locale,
    name: "La Cour de Haut",
    description: meta("description"),
    url: `${BASE_URL}/${locale}`,
    image: new URL(HeroImage.src, BASE_URL).toString(),
    pricePerNight: settings.price_per_night,
    telephone: settings.property_telephone
      ? toE164(settings.property_telephone)
      : undefined,
    email: settings.property_email,
    latitude: settings.property_latitude,
    longitude: settings.property_longitude,
    checkinTime: settings.property_checkin_time,
    checkoutTime: settings.property_checkout_time,
    bedrooms: settings.property_bedrooms,
    aggregate,
  });

  return (
    <>
      {/* Scrub `<` to its unicode escape to prevent `</script>`-style XSS
          injection via any DB-sourced string (Next JSON-LD guide). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <SiteHeader
        action={
          <Button
            asChild
            className="w-full md:col-start-10 lg:col-start-11 md:col-end-14"
            size="lg"
          >
            <Link href="/book">{t("bookNow")}</Link>
          </Button>
        }
      />
      <main>
        <Hero locale={locale as Locale} />
        <GiteSection locale={locale as Locale} />
        <ReviewsSection locale={locale as Locale} />
        <PoiSection locale={locale as Locale} />
        <AboutUsSection locale={locale as Locale} />
      </main>
    </>
  );
}
