import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { getDb } from "@/db";
import { galleryImage } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { GiteDialog } from "./gite-dialog";

export async function GiteSection({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "sections.gite" });

  const db = getDb();
  const allPublished = await db
    .select({ id: galleryImage.id, imageUrl: galleryImage.imageUrl })
    .from(galleryImage)
    .where(eq(galleryImage.published, true))
    .orderBy(asc(galleryImage.sortOrder));

  const image1: (typeof allPublished)[0] | null = allPublished[0] || null;
  const image2: (typeof allPublished)[0] | null = allPublished[1] || null;
  const image3: (typeof allPublished)[0] | null = allPublished[2] || null;
  const image4: (typeof allPublished)[0] | null = allPublished[3] || null;

  if (allPublished.length === 0) return null;

  return (
    <section data-testid="gite-section" className="py-16">
      <div className="flex flex-col md:grid md:grid-cols-[24px_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_24px] lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_2fr] gap-6 pb-30 md:pb-0 md:items-center">
        <div className="col-start-2 col-span-7 lg:col-start-2 lg:col-span-5 grid md:grid-cols-subgrid gap-4 md:gap-6 max-md:px-4">
          <div className="space-y-6 col-span-full md:pt-30">
            <h2 className="text-style-display-large">{t("title")}</h2>
            <p className="text-style-body-large">
              {/* TODO: replace with proper content */}
              lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec
              euismod, nisl eget consectetur sagittis, nisl nunc consectetur
              nisi, euismod aliquam nisl nunc euismod nisi. Donec euismod, nisl
              eget consectetur sagittis, nisl nunc consectetur nisi, euismod
              aliquam nisl nunc euismod nisi.
            </p>
          </div>

          <div className="contents md:hidden">
            {image1 && (
              <div className="relative aspect-3/2 col-span-full">
                <Image
                  src={image1.imageUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
              </div>
            )}
            {image2 && (
              <div className="relative aspect-3/2 col-span-full">
                <Image
                  src={image2.imageUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
              </div>
            )}

            {allPublished.length > 2 && (
              <GiteDialog images={allPublished}>
                {t("viewMorePhotos")}
              </GiteDialog>
            )}
          </div>

          {image2 && (
            <div className="max-md:hidden relative aspect-3/2 col-start-2 col-end-9 lg:col-end-6">
              <Image
                src={image2.imageUrl}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            </div>
          )}
          {image4 && (
            <div className="max-md:hidden relative aspect-3/2 col-span-full">
              <Image
                src={image4.imageUrl}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            </div>
          )}
        </div>

        <div className="max-md:hidden col-start-9 lg:col-start-7 col-end-14 md:grid md:grid-cols-subgrid gap-4">
          {image1 && (
            <div className="relative aspect-3/2 col-span-full">
              <Image
                src={image1.imageUrl}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            </div>
          )}
          {image3 && (
            <div className="relative aspect-3/2 col-start-1 col-end-6">
              <Image
                src={image3.imageUrl}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            </div>
          )}

          {allPublished.length > 4 && (
            <GiteDialog
              images={allPublished}
              className="col-span-full justify-self-start"
            >
              {t("viewMorePhotos")}
            </GiteDialog>
          )}
        </div>
      </div>
    </section>
  );
}
