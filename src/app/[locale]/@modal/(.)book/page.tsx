import type { Metadata } from "next";
import { getTranslations } from "@/i18n/server";
import type { Locale } from "@/i18n/routing";
import { BookModalClient } from "./book-modal-client";

// ISR: matches /book — booked dates are eventually-consistent (ADR-0005).
export const revalidate = 600;
import { getBookedDatesAction } from "../../book/action";

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

export default async function BookModalPage() {
  const bookedDates = getBookedDatesAction();
  return <BookModalClient bookedDates={bookedDates} />;
}
