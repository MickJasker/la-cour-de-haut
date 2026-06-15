import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BookForm } from "@/components/sections/book-form";
import { Header } from "@/components/sections/header";

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

export default function BookPage() {
  return (
    <>
      <Header />
      <main className="flex flex-1 items-center justify-center p-6">
        <BookForm />
      </main>
    </>
  );
}
