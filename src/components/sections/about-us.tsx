import { Locale } from "@/i18n/routing";
import AboutUsImage from "./about-us.jpg";
import Image from "next/image";
import { getTranslations } from "@/i18n/server";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getDb } from "@/db";
import { contentBlock } from "@/db/schema";
import { eq } from "drizzle-orm";
import { pickLocalized } from "@/lib/translation/localized-field";
import { hasEditorText } from "@/lib/content/lexical/empty-state";
import { RichTextRenderer } from "../rich-text-renderer";

export async function AboutUsSection({ locale }: { locale: Locale }) {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.content);

  const db = getDb();
  const descRow = await db
    .select({ value: contentBlock.value })
    .from(contentBlock)
    .where(eq(contentBlock.key, "about_us_description"))
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

  if (!description) return null;

  const t = await getTranslations({ locale, namespace: "sections.aboutUs" });
  return (
    <section
      data-testid="about-us-section"
      className="flex flex-col max-md:px-4 md:grid md:grid-cols-[24px_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_24px] lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_2fr] gap-4 md:gap-6 py-20 bg-sage-400 text-teal-800 items-center"
    >
      <div className="md:col-start-2 md:col-span-6 lg:col-start-2 lg:col-span-5 flex flex-col gap-4">
        <h2 className="text-style-display-large text-balance">{t("title")}</h2>
        {description && (
          <RichTextRenderer
            state={description}
            className="text-style-body-large"
          />
        )}
      </div>
      <Image
        src={AboutUsImage}
        alt="René en Yvonne"
        className="md:col-start-8 md:col-span-6 lg:col-start-9 lg:col-span-5 rounded-lg object-cover"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
    </section>
  );
}
