import type { Metadata } from "next";
import { getTranslations } from "@/i18n/server";
import type { Locale } from "@/i18n/routing";
import { BookForm } from "@/components/sections/book-form";

// ISR: booked dates are already eventually-consistent (iCal sources refresh
// lazily ~hourly, ADR-0005), so a short revalidate window is plenty fresh.
export const revalidate = 600;
import { Header } from "@/components/sections/header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getBookedDatesAction } from "./action";

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

  return (
    <>
      <Header
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
        <BookForm bookedDates={bookedDates} />
        <div className="h-22" />
      </main>
    </>
  );
}
