import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations } from "@/i18n/server";
import { locales, type Locale } from "@/i18n/routing";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://lacourdehaut.fr";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "privacy.metadata",
  });
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `${BASE_URL}/${locale}/privacy`,
      languages: Object.fromEntries([
        ...locales.map((loc) => [loc, `${BASE_URL}/${loc}/privacy`]),
        ["x-default", `${BASE_URL}/nl/privacy`],
      ]),
    },
    openGraph: { url: `${BASE_URL}/${locale}/privacy` },
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "privacy",
  });

  return (
    <main className="flex flex-col flex-1 items-center p-6 py-12">
      <article className="w-full max-w-2xl space-y-8">
        <h1 className="text-style-display-medium">{t("title")}</h1>
        <p className="text-style-body-large">{t("intro")}</p>

        <section className="space-y-2">
          <h2 className="text-style-eyebrow-large">
            {t("dataCollectedTitle")}
          </h2>
          <p>{t("dataCollectedBody")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-style-eyebrow-large">{t("purposeTitle")}</h2>
          <p>{t("purposeBody")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-style-eyebrow-large">{t("retentionTitle")}</h2>
          <p>{t("retentionBody")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-style-eyebrow-large">{t("rightsTitle")}</h2>
          <p>{t("rightsBody")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-style-eyebrow-large">{t("contactTitle")}</h2>
          <p>{t("contactBody")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-style-eyebrow-large">{t("turnstileTitle")}</h2>
          <p>
            {t.rich("turnstileBody", {
              link: (chunks: ReactNode) => (
                <a
                  href="https://www.cloudflare.com/cloudflare-turnstile-privacy-addendum/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:opacity-75 transition-opacity"
                >
                  {chunks}
                </a>
              ),
            })}
          </p>
        </section>
      </article>
    </main>
  );
}
