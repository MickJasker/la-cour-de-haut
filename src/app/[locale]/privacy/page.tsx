import type { Metadata } from "next";
import { getTranslations } from "@/i18n/server";
import type { Locale } from "@/i18n/routing";

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
      </article>
    </main>
  );
}
