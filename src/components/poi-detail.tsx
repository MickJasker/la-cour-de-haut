import Image from "next/image";
import type { Locale } from "@/i18n/routing";
import type { poi } from "@/db/schema";
import { RichTextRenderer } from "@/components/rich-text-renderer";
import { pickLocalized } from "@/lib/localized-field";

type Poi = typeof poi.$inferSelect;

/**
 * The shared POI detail content (hero image, title, distance, rich body),
 * rendered identically in the intercepted dialog and the standalone page. The
 * outer width/padding is supplied by each wrapper; this component is layout-
 * neutral. The rich `detail` falls back to Dutch when a locale is missing.
 */
export function PoiDetail({ item, locale }: { item: Poi; locale: Locale }) {
  const title = pickLocalized(item.title, locale);
  const body = pickLocalized(item.body, locale);
  const detailState = item.detail ? pickLocalized(item.detail, locale) : null;

  return (
    <article className="flex flex-col gap-5">
      <div className="relative aspect-3/2 w-full overflow-hidden rounded-lg">
        <Image
          src={item.imageUrl}
          alt={title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 640px"
          priority
        />
        {item.distanceKm != null && (
          <div
            data-testid="poi-distance"
            className="absolute bottom-3 left-3 flex items-center rounded-full bg-black/10 px-3 py-2 backdrop-blur-sm"
          >
            <span className="text-[12px] leading-none text-white">
              {item.distanceKm} km
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h1 className="text-style-display-small font-bold!">{title}</h1>
        <p className="text-style-body-medium text-stone-600">{body}</p>
        {detailState && <RichTextRenderer state={detailState} />}
      </div>
    </article>
  );
}
