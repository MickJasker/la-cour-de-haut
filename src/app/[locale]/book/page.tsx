import type { Metadata } from "next";
import { getTranslations } from "@/i18n/server";
import { locales, type Locale } from "@/i18n/routing";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://lacourdehaut.fr";
import { BookForm } from "@/components/sections/book-form";
import { BookFormSkeleton } from "@/components/sections/book-form-skeleton";
import { SiteHeader } from "@/components/sections/site-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getBookedDatesAction, getPricePerNightAction } from "./action";
import { Suspense } from "react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "metadata.book",
  });
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `${BASE_URL}/${locale}/book`,
      languages: Object.fromEntries([
        ...locales.map((loc) => [loc, `${BASE_URL}/${loc}/book`]),
        ["x-default", `${BASE_URL}/nl/book`],
      ]),
    },
    openGraph: { url: `${BASE_URL}/${locale}/book` },
  };
}

export default async function BookPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const t = await getTranslations({
    locale: (await params).locale as Locale,
    namespace: "booking",
  });
  const bookedDates = getBookedDatesAction();
  const pricePerNight = getPricePerNightAction();

  return (
    <>
      <SiteHeader
        action={
          <Button
            asChild
            className="w-full md:col-start-10 lg:col-start-11 md:col-end-14"
            size="lg"
          >
            <Link href={`/`}>{t("aboutAction")}</Link>
          </Button>
        }
      />
      <main className="flex flex-col flex-1 items-center justify-center p-6">
        <Suspense fallback={<BookFormSkeleton />}>
          <BookForm bookedDates={bookedDates} pricePerNight={pricePerNight} />
        </Suspense>
        <div className="h-22" />
      </main>
    </>
  );
}
