import { getTranslations } from "@/i18n/server";
import type { Locale } from "@/i18n/routing";
import { Button } from "../ui/button";
import { Link } from "@/i18n/navigation";
import { Logo } from "../ui/logo";
import heroImage from "./hero.jpg";
import Image from "next/image";
import { getDb } from "@/db";
import { contentBlock } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { RichTextRenderer } from "../rich-text-renderer";
import { hasEditorText } from "@/lib/lexical/empty-state";
import { pickLocalized } from "@/lib/localized-field";
import { CACHE_TAGS } from "@/lib/cache-tags";

export async function Hero({ locale }: { locale: Locale }) {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.content);

  const t = await getTranslations({ locale, namespace: "sections.hero" });

  const db = getDb();
  const rows = await db
    .select({ key: contentBlock.key, value: contentBlock.value })
    .from(contentBlock)
    .where(inArray(contentBlock.key, ["hero_image_url", "hero_description"]));

  const imageRow = rows.find((r) => r.key === "hero_image_url");
  const heroImageUrl =
    imageRow?.value?.type === "imageUrl" ? imageRow.value.url : null;

  const descRow = rows.find((r) => r.key === "hero_description");
  const heroDescriptionState =
    descRow?.value?.type === "localizedEditorState"
      ? pickLocalized(descRow.value, locale)
      : null;
  const showHeroDescription =
    heroDescriptionState !== null && hasEditorText(heroDescriptionState);

  return (
    <div
      data-testid="hero-section"
      className="grid grid-cols-[24px_1fr_24px] md:grid-cols-[24px_6fr_6fr_6fr_24px] lg:grid-cols-[2fr_3fr_4fr_4fr_2fr] xl:grid-cols-[2fr_3fr_1fr_8fr_2fr] min-h-[calc(100svh-5.5rem)] md:max-h-225 gap-4 items-end md:items-center bg-brand-forest text-olive-50"
    >
      <div className="col-span-full md:col-start-3 md:col-end-6 bg-cream-50 w-full h-full row-start-1 row-end-2 relative">
        {heroImageUrl ? (
          <Image
            src={heroImageUrl}
            alt=""
            className="w-full h-full object-cover bg-blend-multiply"
            fill
            preload
            aria-hidden="true"
            sizes="(max-width: 768px) 100vw, 66vw"
          />
        ) : (
          <Image
            src={heroImage}
            alt=""
            className="w-full h-full object-cover bg-blend-multiply"
            fill
            preload
            aria-hidden="true"
            sizes="(max-width: 768px) 100vw, 66vw"
            placeholder="blur"
          />
        )}
        <div className="absolute h-150 md:h-full bottom-0 md:top-0 left-0 w-full md:w-125 bg-linear-to-t md:bg-linear-to-r from-brand-forest to-brand-forest/0"></div>
      </div>
      <div className="col-start-2 col-end-3 md:col-end-4 row-start-1 row-end-2 relative flex flex-col gap-6 py-20 text-sage">
        <h1 className="contents">
          <Logo className="w-full h-auto" />
        </h1>
        {showHeroDescription && (
          <RichTextRenderer
            state={heroDescriptionState}
            className="text-style-body-large"
          />
        )}
        <Button asChild variant="secondary" size="lg" className="max-md:hidden">
          <Link href="/book">{t("callToAction")}</Link>
        </Button>
      </div>
    </div>
  );
}
