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

  const gridImages = allPublished.slice(0, 4);

  if (allPublished.length === 0) return null;

  return (
    <section data-testid="gite-section" className="py-16 px-6">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 items-start">
        <div className="space-y-6">
          <h2 className="text-3xl font-semibold">{t("title")}</h2>
        </div>

        <div className="space-y-4">
          <div data-testid="gite-grid" className="grid grid-cols-2 gap-2">
            {gridImages.map((img) => (
              <div key={img.id} className="relative aspect-square">
                <Image
                  src={img.imageUrl}
                  alt=""
                  fill
                  className="object-cover rounded"
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
              </div>
            ))}
          </div>

          {allPublished.length > 0 && (
            <GiteDialog
              buttonLabel={t("viewMorePhotos")}
              images={allPublished}
            />
          )}
        </div>
      </div>
    </section>
  );
}
