import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Mulish, PT_Serif } from "next/font/google";
import { notFound } from "next/navigation";
import { I18nProvider } from "@/i18n/provider";
import { getDictionary } from "@/i18n/dictionaries";
import { getTranslations } from "@/i18n/server";
import { locales, hasLocale } from "@/i18n/routing";
import "../globals.css";

const mulish = Mulish({
  variable: "--font-mulish",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const ptSerif = PT_Serif({
  variable: "--font-pt-serif",
  subsets: ["latin"],
  weight: ["700"],
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "metadata.home" });
  return {
    title: {
      default: t("title"),
      template: `%s · La Cour de Haut`,
    },
    description: t("description"),
  };
}

interface Props {
  children: ReactNode;
  modal: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, modal, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const messages = await getDictionary(locale);

  return (
    <html
      lang={locale}
      className={`${mulish.variable} ${ptSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <I18nProvider locale={locale} messages={messages}>
          {children}
          {modal}
        </I18nProvider>
      </body>
    </html>
  );
}
