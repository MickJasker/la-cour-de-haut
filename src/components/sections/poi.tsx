import type { Locale } from "@/i18n/routing";
import { getDb } from "@/db";
import { poi } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getTranslations } from "@/i18n/server";
import Image from "next/image";

export async function PoiSection({ locale }: { locale: Locale }) {
  "use cache";
  cacheLife("hours");
  cacheTag("poi");

  const [t, published] = await Promise.all([
    getTranslations({ locale, namespace: "sections.poi" }),
    getDb()
      .select()
      .from(poi)
      .where(eq(poi.published, true))
      .orderBy(asc(poi.sortOrder)),
  ]);

  if (published.length === 0) return null;

  return (
    <section
      data-testid="poi-section"
      className="py-16 lg:py-24 bg-brand-sage text-teal-800"
    >
      <div className="flex flex-col max-md:px-4 md:grid md:grid-cols-[24px_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_24px] lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_2fr] gap-4 md:gap-6">
        <h2 className="text-style-display-large md:col-span-12 md:col-start-2">
          {t("title")}
        </h2>
        <div className="md:col-span-12 md:col-start-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-6">
          {published.map((item) => (
            <article
              key={item.id}
              data-testid="poi-card"
              className="flex flex-col gap-1"
            >
              <div className="relative aspect-3/2 rounded-md overflow-hidden">
                <Image
                  src={item.imageUrl}
                  alt={item.title[locale] ?? item.title.nl}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 17vw"
                />
                {item.distanceKm != null && (
                  <div
                    data-testid="poi-distance"
                    className="absolute bottom-2 left-2 flex items-center backdrop-blur-sm bg-black/10 rounded-full px-3 py-2"
                  >
                    <span className="text-white text-[12px] leading-none">
                      {item.distanceKm} km
                    </span>
                  </div>
                )}
              </div>
              <h3 className="text-style-display-small font-bold!">
                {item.title[locale] ?? item.title.nl}
              </h3>
              <p className="text-style-body-medium">
                {item.body[locale] ?? item.body.nl}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
