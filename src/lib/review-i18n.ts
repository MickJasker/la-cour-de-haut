import { locales, type Locale } from "@/i18n/routing";

export type ReviewBody = Partial<Record<Locale, string>>;
export type ReviewBodySource = Partial<Record<Locale, "human" | "machine">>;

function isDisplayLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/**
 * Resolves the body text to show a visitor, given their active locale. Quoted
 * content (reviews) may be missing any display-locale slot, so this walks the
 * full fallback chain defined in ADR-0014, ending at the verbatim original.
 */
export function resolveReviewBody(
  review: { body: ReviewBody; originalBody: string },
  locale: Locale,
): string {
  const { body } = review;
  return (
    body[locale] ??
    body.nl ??
    body.en ??
    body.fr ??
    body.de ??
    review.originalBody ??
    ""
  );
}

/**
 * Decides whether a review card should show the "translated from <language>"
 * marker, and from which language. The marker appears only when the visitor is
 * reading a machine-translated slot in their *own* locale — never on a human
 * (original-language) slot or a cross-locale fallback. Returns the original
 * locale code (possibly the `und` sentinel) or null when no marker is shown.
 */
export function reviewTranslatedFrom(
  review: { bodySource: ReviewBodySource; originalLocale: string },
  locale: Locale,
): string | null {
  return review.bodySource[locale] === "machine" ? review.originalLocale : null;
}

/**
 * Computes the `body` projection and its per-locale `bodySource` map from a
 * review's source of truth plus any machine translations. When the original
 * locale is one of the four display locales, its slot is seeded verbatim from
 * `originalBody` and marked `human`; every machine translation is marked
 * `machine`. A foreign original contributes no human display slot. See
 * ADR-0014.
 */
export function buildReviewBody(input: {
  originalLocale: string;
  originalBody: string;
  translations: ReviewBody;
}): { body: ReviewBody; bodySource: ReviewBodySource } {
  const body: ReviewBody = {};
  const bodySource: ReviewBodySource = {};

  for (const [locale, text] of Object.entries(input.translations)) {
    if (text == null) continue;
    body[locale as Locale] = text;
    bodySource[locale as Locale] = "machine";
  }

  if (isDisplayLocale(input.originalLocale)) {
    body[input.originalLocale] = input.originalBody;
    bodySource[input.originalLocale] = "human";
  }

  return { body, bodySource };
}
