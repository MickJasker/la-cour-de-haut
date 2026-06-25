import type { Locale } from "@/i18n/routing";
import { getDb } from "@/db";
import { review } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

const SOURCE_LABELS: Record<string, string> = {
  airbnb: "AirBnB",
  natuurhuisje: "Natuurhuisje",
  direct: "direct",
};

function Stars({ rating }: { rating: number }) {
  return (
    <div aria-label={`${rating} van 5 sterren`} className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          viewBox="0 0 16 16"
          className={`w-4 h-4 ${i < rating ? "fill-amber-400" : "fill-stone-200"}`}
          aria-hidden
        >
          <path d="M8 1l2.06 4.18L15 6.27l-3.5 3.41.83 4.82L8 12.1l-4.33 2.4.83-4.82L1 6.27l4.94-.09z" />
        </svg>
      ))}
    </div>
  );
}

export async function ReviewsSection({ locale }: { locale: Locale }) {
  "use cache";
  cacheLife("hours");
  cacheTag("reviews");

  const db = getDb();
  const published = await db
    .select()
    .from(review)
    .where(eq(review.published, true))
    .orderBy(asc(review.sortOrder));

  if (published.length === 0) return null;

  return (
    <section data-testid="reviews-section" className="py-16 bg-amber-50/40">
      <div className="px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {published.map((r) => {
            const body =
              r.body[locale as keyof typeof r.body] ?? r.body.nl ?? "";
            return (
              <article
                key={r.id}
                data-testid="review-card"
                className="bg-white rounded-xl p-6 shadow-sm flex flex-col gap-4"
              >
                <Stars rating={r.rating} />
                <blockquote className="text-stone-700 flex-1">
                  &ldquo;{body}&rdquo;
                </blockquote>
                <footer className="text-sm text-stone-500 text-right">
                  <p>— {r.authorName}</p>
                  <p>
                    {r.reviewDate} – via {SOURCE_LABELS[r.source] ?? r.source}
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
