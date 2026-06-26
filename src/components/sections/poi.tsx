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
    <section data-testid="poi-section" className="py-16 lg:py-24 bg-[#c6dfca]">
      <div className="flex flex-col max-md:px-4 md:grid md:grid-cols-[24px_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_24px] lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_2fr] gap-4 md:gap-6">
        <h2 className="font-pt-serif font-bold text-5xl text-[#3a461c] md:col-span-12 md:col-start-2">
          {t("title")}
        </h2>
        <div className="md:col-span-12 md:col-start-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-[22px]">
          {published.map((item) => (
            <article
              key={item.id}
              data-testid="poi-card"
              className="flex flex-col gap-2"
            >
              <div className="relative h-[121px] rounded-[8px] overflow-hidden">
                <Image
                  src={item.imageUrl}
                  alt={item.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 17vw"
                />
                {item.distanceKm != null && (
                  <div
                    data-testid="poi-distance"
                    className="absolute bottom-2 left-2 flex items-center backdrop-blur-sm bg-black/30 rounded-full px-2 py-1"
                  >
                    <span className="text-white text-[10px] leading-none">
                      {item.distanceKm} km
                    </span>
                  </div>
                )}
              </div>
              <p className="font-pt-serif font-bold text-[14px] text-[#3a461c] leading-[1.1]">
                {item.title}
              </p>
              <p className="font-mulish text-[10px] text-[#3a461c] opacity-80 leading-[1.1]">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
