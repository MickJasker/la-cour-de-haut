import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BookForm } from "@/components/sections/book-form";
import { Header } from "@/components/sections/header";
import { Button } from "@/components/ui/button";
import Link from "next/dist/client/link";
import { getBookedDatesAction } from "./action";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata.book" });
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
    locale: (await params).locale,
    namespace: "booking",
  });
  const bookedDates = getBookedDatesAction();

  return (
    <>
      <Header
        action={
          <Button
            asChild
            className="w-full md:col-start-11 md:col-end-14"
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
