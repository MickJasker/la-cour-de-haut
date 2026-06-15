import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Mulish, PT_Serif } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
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
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
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
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${mulish.variable} ${ptSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          {modal}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
