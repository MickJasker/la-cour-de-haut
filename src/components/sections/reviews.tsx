import type { Locale } from "@/i18n/routing";
import { getDb } from "@/db";
import { review } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getTranslations } from "@/i18n/server";
import { formatDistance } from "date-fns";
import { nl, fr, enGB, de } from "date-fns/locale";

function getDateFnsLocale(locale: Locale) {
  switch (locale) {
    case "nl":
      return nl;
    case "fr":
      return fr;
    case "en":
      return enGB;
    case "de":
      return de;
    default:
      return nl;
  }
}

const SOURCE_LABELS: Record<string, string> = {
  airbnb: "AirBnB",
  natuurhuisje: "Natuurhuisje",
  google: "Google",
  direct: "direct",
};

function Stars({ rating }: { rating: number }) {
  return (
    <div aria-label={`${rating} van 5 sterren`} className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          width="19"
          height="19"
          viewBox="0 0 19 19"
          className={`size-5 ${i < rating ? "fill-amber-400" : "fill-stone-200"}`}
        >
          <path d="M9.4 0L12.3 5.9L18.8 6.8L14.1 11.4L15.2 17.9L9.4 15.3L3.6 18.4L4.7 11.9L0 6.8L6.5 5.9L9.4 0Z" />
        </svg>
      ))}
    </div>
  );
}

export async function ReviewsSection({ locale }: { locale: Locale }) {
  "use cache";
  cacheLife("hours");
  cacheTag("reviews");

  const [t, published] = await Promise.all([
    getTranslations({ locale, namespace: "sections.reviews" }),
    getDb()
      .select()
      .from(review)
      .where(eq(review.published, true))
      .orderBy(asc(review.sortOrder)),
  ]);

  if (published.length === 0) return null;

  return (
    <section
      data-testid="reviews-section"
      className="py-16 lg:py-24 bg-cream-200"
    >
      <div className="flex flex-col max-md:px-4 md:grid md:grid-cols-[24px_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_24px] lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_2fr] gap-4 md:gap-6 ">
        <div className="contents md:grid md:grid-cols-subgrid md:col-span-12 md:col-start-2 md:gap-4 lg:gap-6">
          {published.map((r) => {
            const body =
              r.body[locale as keyof typeof r.body] ?? r.body.nl ?? "";

            return (
              <article
                key={r.id}
                data-testid="review-card"
                className="bg-cream-50 rounded-xl p-6 shadow-sm flex flex-col gap-4 md:col-span-4"
              >
                <Stars rating={r.rating} />
                <blockquote className="text-stone-700 flex-1 italic">
                  &ldquo;{body}&rdquo;
                </blockquote>
                <footer className="text-sm text-stone-500 text-right">
                  <p>— {r.authorName}</p>
                  <p>
                    {t("roughDate", {
                      distance: formatDistance(
                        new Date(r.reviewDate),
                        new Date(),
                        {
                          locale: getDateFnsLocale(locale),
                        },
                      ),
                    })}
                    {" | "}
                    {t("source", {
                      source: SOURCE_LABELS[r.source] ?? r.source,
                    })}
                  </p>
                </footer>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
