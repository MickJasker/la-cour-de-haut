import { getTranslations } from "@/i18n/server";
import type { Locale } from "@/i18n/routing";
import Image from "next/image";
import { getDb } from "@/db";
import { galleryImage, contentBlock } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { GiteDialog } from "./gite-dialog";
import { GeneralInfoDialog } from "./general-info-dialog";
import { cacheLife, cacheTag } from "next/cache";
import { RichTextRenderer } from "../rich-text-renderer";
import { hasEditorText } from "@/lib/content/lexical/empty-state";
import { pickLocalized } from "@/lib/translation/localized-field";
import { CACHE_TAGS } from "@/lib/cache-tags";

export async function GiteSection({ locale }: { locale: Locale }) {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.gallery);
  cacheTag(CACHE_TAGS.content);
  const t = await getTranslations({ locale, namespace: "sections.gite" });

  const db = getDb();
  const descRow = await db
    .select({ value: contentBlock.value })
    .from(contentBlock)
    .where(eq(contentBlock.key, "description"))
    .limit(1)
    .then((r) => r[0] ?? null);
  const descriptionState =
    descRow?.value?.type === "localizedEditorState"
      ? pickLocalized(descRow.value, locale)
      : null;
  const description =
    descriptionState !== null && hasEditorText(descriptionState)
      ? descriptionState
      : null;

  const generalInfoRow = await db
    .select({ value: contentBlock.value })
    .from(contentBlock)
    .where(eq(contentBlock.key, "general_info"))
    .limit(1)
    .then((r) => r[0] ?? null);
  const generalInfoState =
    generalInfoRow?.value?.type === "localizedEditorState"
      ? pickLocalized(generalInfoRow.value, locale)
      : null;
  const generalInfo =
    generalInfoState !== null && hasEditorText(generalInfoState)
      ? generalInfoState
      : null;

  const allPublished = await db
    .select({
      id: galleryImage.id,
      imageUrl: galleryImage.imageUrl,
      altText: galleryImage.altText,
      width: galleryImage.width,
      height: galleryImage.height,
    })
    .from(galleryImage)
    .where(eq(galleryImage.published, true))
    .orderBy(asc(galleryImage.sortOrder));

  if (allPublished.length === 0 && !description && !generalInfo) return null;

  // Each image renders exactly once; responsive grid placement recreates the
  // staggered desktop masonry while stacking image1/image2 on mobile.
  const image1 = allPublished[0] ?? null;
  const image2 = allPublished[1] ?? null;
  const image3 = allPublished[2] ?? null;
  const image4 = allPublished[3] ?? null;

  return (
    <section data-testid="gite-section" className="py-16">
      <div
        data-testid="gite-grid"
        className="flex flex-col md:grid md:grid-cols-[24px_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_24px] lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_2fr] gap-4 md:gap-6 md:items-center max-md:px-4"
      >
        <div className="max-md:contents md:col-start-2 md:col-end-9 lg:col-end-7 md:grid md:grid-cols-subgrid gap-4 md:gap-6">
          <div className="space-y-6 md:pt-30 md:row-start-1 md:col-start-1 md:col-end-9 lg:col-end-7">
            <h2 className="text-style-display-large">{t("title")}</h2>
            {description && (
              <RichTextRenderer
                state={description}
                className="text-style-body-large"
              />
            )}
          </div>

          {image3 && (
            <div className="relative max-md:hidden aspect-3/2 md:col-start-2 md:col-end-9 lg:col-start-2 lg:col-end-7">
              <Image
                src={image3.imageUrl}
                alt={
                  image3.altText ? pickLocalized(image3.altText, locale) : ""
                }
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            </div>
          )}

          {image2 && (
            <div className="relative aspect-3/2 md:col-span-full">
              <Image
                src={image2.imageUrl}
                alt={
                  image2.altText ? pickLocalized(image2.altText, locale) : ""
                }
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            </div>
          )}
        </div>

        <div className="max-md:contents md:col-start-9 md:col-end-14 lg:col-start-7 lg:col-end-14 md:grid md:grid-cols-subgrid gap-4 md:gap-6">
          {image1 && (
            <div className="relative aspect-3/2 md:col-span-full">
              <Image
                src={image1.imageUrl}
                alt={
                  image1.altText ? pickLocalized(image1.altText, locale) : ""
                }
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            </div>
          )}

          {image4 && (
            <div className="max-md:hidden relative aspect-3/2 md:col-start-1 md:col-end-9 lg:col-start-1 lg:col-end-6">
              <Image
                src={image4.imageUrl}
                alt={
                  image4.altText ? pickLocalized(image4.altText, locale) : ""
                }
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            </div>
          )}

          {(allPublished.length > 2 || generalInfo) && (
            <div
              className={`flex flex-col md:flex-row gap-4 justify-self-start md:row-start-3 md:col-start-9 lg:col-start-1 lg:col-end-7 ${
                allPublished.length <= 4 && !generalInfo ? "md:hidden" : ""
              }`}
            >
              {allPublished.length > 2 && (
                <GiteDialog
                  images={allPublished}
                  className={allPublished.length <= 4 ? "md:hidden" : undefined}
                >
                  {t("viewMorePhotos")}
                </GiteDialog>
              )}

              {generalInfo && (
                <GeneralInfoDialog title={t("generalInfo")} state={generalInfo}>
                  {t("generalInfo")}
                </GeneralInfoDialog>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
