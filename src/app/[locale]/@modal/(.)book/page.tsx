import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BookModalClient } from "./book-modal-client";
import { getBookedDatesAction } from "../../book/action";

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

export default async function BookModalPage() {
  const bookedDates = getBookedDatesAction();
  return <BookModalClient bookedDates={bookedDates} />;
}
