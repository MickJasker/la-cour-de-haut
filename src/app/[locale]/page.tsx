import { Header } from "@/components/sections/header";
import { Hero } from "@/components/sections/hero";
import { GiteSection } from "@/components/sections/gite";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "@/i18n/server";
import type { Locale } from "@/i18n/routing";

// ISR: cache the rendered page, regenerate hourly. The only DB-backed content is
// the gallery (GiteSection), which changes rarely.
export const revalidate = 3600;

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "sections.header",
  });

  return (
    <>
      <Header
        action={
          <Button
            asChild
            className="w-full md:col-start-10 lg:col-start-11 md:col-end-14"
            size="lg"
          >
            <Link href="/book">{t("bookNow")}</Link>
          </Button>
        }
      />
      <main>
        <Hero locale={locale as Locale} />
        <GiteSection locale={locale as Locale} />
      </main>
    </>
  );
}
