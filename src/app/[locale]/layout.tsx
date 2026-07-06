import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Mulish, PT_Serif } from "next/font/google";
import { notFound } from "next/navigation";
import { I18nProvider } from "@/i18n/provider";
import { getDictionary } from "@/i18n/dictionaries";
import { getTranslations } from "@/i18n/server";
import { hasLocale, locales } from "@/i18n/routing";
import "../globals.css";
import { Footer } from "@/components/sections/footer";
import { ModalSlot } from "./modal-slot";
import { getBaseUrl } from "@/lib/base-url";

const OG_LOCALE: Record<string, string> = {
  nl: "nl_NL",
  en: "en_US",
  fr: "fr_FR",
  de: "de_DE",
};

const BASE_URL = getBaseUrl();

const mulish = Mulish({
  variable: "--font-mulish",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const ptSerif = PT_Serif({
  variable: "--font-pt-serif",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

// Brand forest — tints the mobile browser chrome to match the header/hero.
export const viewport: Viewport = {
  themeColor: "#4b5a23",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "metadata.home" });

  return {
    metadataBase: new URL(BASE_URL),
    title: {
      default: t("title"),
      template: `%s · La Cour de Haut`,
    },
    description: t("description"),
    // og:image / twitter:image come from the opengraph-image / twitter-image
    // route files under [locale]; only the card type is set here.
    openGraph: {
      type: "website",
      locale: OG_LOCALE[locale],
    },
    twitter: {
      card: "summary_large_image",
    },
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
          <Footer locale={locale} />
          <ModalSlot>{modal}</ModalSlot>
        </I18nProvider>
      </body>
    </html>
  );
}
