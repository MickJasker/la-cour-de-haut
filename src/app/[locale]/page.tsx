import type { Metadata } from "next";
import { Header } from "@/components/sections/header";
import { Hero } from "@/components/sections/hero";
import { GiteSection } from "@/components/sections/gite";
import { ReviewsSection } from "@/components/sections/reviews";
import { PoiSection } from "@/components/sections/poi";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "@/i18n/server";
import { locales, type Locale } from "@/i18n/routing";
import HeroImage from "@/components/sections/hero.jpg";

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
    openGraph: {
      url: `${BASE_URL}/${locale}`,
      images: [{ url: HeroImage.src }],
    },
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "sections.header",
  });

  return (
    <>
      <Header
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
      </main>
    </>
  );
}
