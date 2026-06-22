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

  if (allPublished.length === 0) return null;

  // First four drive the inline grid; the dialog shows the full set.
  const gridImages = allPublished.slice(0, 4);

  return (
    <section data-testid="gite-section" className="py-16">
      <div className="flex flex-col md:grid md:grid-cols-[24px_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_24px] lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_2fr] gap-6 pb-30 md:pb-0 md:items-center">
        <div className="col-start-2 col-span-7 lg:col-start-2 lg:col-span-5 space-y-6 max-md:px-4 md:pt-30">
          <h2 className="text-style-display-large">{t("title")}</h2>
          <p className="text-style-body-large">
            {/* TODO: replace with proper content */}
            lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec
            euismod, nisl eget consectetur sagittis, nisl nunc consectetur nisi,
            euismod aliquam nisl nunc euismod nisi. Donec euismod, nisl eget
            consectetur sagittis, nisl nunc consectetur nisi, euismod aliquam
            nisl nunc euismod nisi.
          </p>
        </div>

        <div className="col-start-9 lg:col-start-7 col-end-14 space-y-4 max-md:px-4">
          <div
            data-testid="gite-grid"
            className="grid grid-cols-2 gap-4 md:gap-6"
          >
            {gridImages.map((img) => (
              <div key={img.id} className="relative aspect-3/2">
                <Image
                  src={img.imageUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
              </div>
            ))}
          </div>

          {allPublished.length > 4 && (
            <GiteDialog images={allPublished} className="justify-self-start">
              {t("viewMorePhotos")}
            </GiteDialog>
          )}
        </div>
      </div>
    </section>
  );
}
