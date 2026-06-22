import { Header } from "@/components/sections/header";
import { Hero } from "@/components/sections/hero";
import { GiteSection } from "@/components/sections/gite";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sections.header" });

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
        <Hero />
        <GiteSection locale={locale} />
      </main>
    </>
  );
}
