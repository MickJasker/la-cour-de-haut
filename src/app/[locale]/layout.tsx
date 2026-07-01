import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { Mulish, PT_Serif } from "next/font/google";
import { notFound } from "next/navigation";
import { I18nProvider } from "@/i18n/provider";
import { getDictionary } from "@/i18n/dictionaries";
import { getTranslations } from "@/i18n/server";
import { hasLocale, locales } from "@/i18n/routing";
import { getDb } from "@/db";
import { contentBlock } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import "../globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Footer } from "@/components/sections/footer";

const OG_LOCALE: Record<string, string> = {
  nl: "nl_NL",
  en: "en_US",
  fr: "fr_FR",
  de: "de_DE",
};

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://lacourdehaut.fr";

async function getHeroImageUrl(): Promise<string | undefined> {
  "use cache";
  cacheLife("max");
  cacheTag("content");

  const db = getDb();
  const row = await db
    .select({ value: contentBlock.value })
    .from(contentBlock)
    .where(eq(contentBlock.key, "hero_image_url"))
    .limit(1)
    .then((rows) => rows[0]);
  return row?.value?.type === "imageUrl" ? row.value.url : undefined;
}

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "metadata.home" });

  const heroImageUrl = await getHeroImageUrl();

  return {
    metadataBase: new URL(BASE_URL),
    title: {
      default: t("title"),
      template: `%s · La Cour de Haut`,
    },
    description: t("description"),
    openGraph: {
      type: "website",
      locale: OG_LOCALE[locale],
      ...(heroImageUrl && { images: [heroImageUrl] }),
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
          {modal}
        </I18nProvider>
        {/* Client component reading useSearchParams; under Cache Components a
            request-time read must sit in a Suspense boundary or the static
            prerender bails ("Render in Browser should be wrapped in a suspense
            boundary"). */}
        <Suspense fallback={null}>
          <SpeedInsights />
        </Suspense>
      </body>
    </html>
  );
}
