import type { Locale } from "@/i18n/routing";
import { getDb } from "@/db";
import { poi } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getTranslations } from "@/i18n/server";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { pickLocalized } from "@/lib/translation/localized-field";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { cn } from "@/lib/utils";

// Desktop (lg) column count per row, as static strings so Tailwind's JIT emits
// each one. Mobile stays 2-col and tablet 3-col regardless.
const LG_COLS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

// Explicit per-count row sizes so the desktop grid never leaves a ragged gap.
// Sizes are re-sorted ascending at render, so the row with the fewest (widest)
// cards sits on top — that's where the most important POIs go (items arrive
// ordered by sortOrder). Counts not listed fall back to balanced rows.
const POI_ROW_LAYOUTS: Record<number, number[]> = {
  7: [3, 4],
  8: [4, 4],
  9: [3, 3, 3],
  10: [5, 5],
  11: [3, 4, 4],
  12: [6, 6],
  13: [4, 4, 5],
  14: [4, 5, 5],
  15: [5, 5, 5],
};

// Fall-back splitter for counts outside the table: rows as even as possible,
// capped at 6, with the bigger (base+1) rows pushed to the bottom so the top
// rows stay the widest.
function balancedRowSizes(n: number, max = 6): number[] {
  const rowCount = Math.ceil(n / max);
  const base = Math.floor(n / rowCount);
  const extra = n % rowCount;
  return Array.from({ length: rowCount }, (_, r) =>
    r >= rowCount - extra ? base + 1 : base,
  );
}

// Group items into rows of the chosen sizes (biggest cards on top).
function poiRows<T>(items: T[]): T[][] {
  const n = items.length;
  const sizes = (POI_ROW_LAYOUTS[n] ?? balancedRowSizes(n))
    .slice()
    .sort((a, b) => a - b);
  const rows: T[][] = [];
  let i = 0;
  for (const size of sizes) {
    rows.push(items.slice(i, i + size));
    i += size;
  }
  if (i < n) rows.push(items.slice(i)); // safety net for malformed table entries
  return rows;
}

export async function PoiSection({ locale }: { locale: Locale }) {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.poi);

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
        <div className="md:col-span-12 md:col-start-2 flex flex-col gap-4 lg:gap-6">
          {poiRows(published).map((row, r) => {
            // Widen the lg image hint to match this row's card width (100/cols),
            // so wider top-row cards still request a sharp enough image.
            const lgVw = Math.round(100 / row.length);
            return (
              <div
                key={r}
                className={cn(
                  "grid grid-cols-2 md:grid-cols-3 gap-4 lg:gap-6",
                  LG_COLS[row.length],
                )}
              >
                {row.map((item) => (
                  <article
                    key={item.id}
                    data-testid="poi-card"
                    className="flex flex-col gap-2"
                  >
                    <Link href={`/poi/${item.slug}`} className="contents group">
                      <div className="relative aspect-3/2 rounded-md overflow-hidden">
                        <Image
                          src={item.imageUrl}
                          alt={pickLocalized(item.title, locale)}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          sizes={`(max-width: 768px) 50vw, (max-width: 1024px) 33vw, ${lgVw}vw`}
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
                      <h3 className="text-style-display-small font-bold! group-hover:underline">
                        {pickLocalized(item.title, locale)}
                      </h3>
                      <p className="text-style-body-medium">
                        {pickLocalized(item.body, locale)}
                      </p>
                    </Link>
                  </article>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
